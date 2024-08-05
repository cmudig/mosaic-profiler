import pathlib
import anywidget
import traitlets
import pandas as pd
import requests
from io import StringIO
import uuid
import logging

import duckdb
import pyarrow as pa

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

_DEV = True

if _DEV:
    # from `npm run dev`
    ESM = "http://localhost:5173/src/index.js?anywidget"
    CSS = ""
else:
    # from `npm run build`
    bundled_assets_dir = pathlib.Path(__file__).parent / "static"
    ESM = bundled_assets_dir / "index.js"
    CSS = ""

class MosaicProfilerWidget(anywidget.AnyWidget):
    _esm = ESM
    _css = CSS

    id = traitlets.Unicode(allow_none=True).tag(sync=True)
    
    def __init__(self, data: pd.DataFrame | str, con=None, *args, **kwargs):
        """Create a Mosaic Profiler widget.

        Args:
            data (pd.DataFrame | str): The initial DataFrame or URL to a CSV file.
            con (connection, optional): A DuckDB connection.
                Defaults to duckdb.connect().
        """
        if con is None:
            con = duckdb.connect()

        super().__init__(*args, **kwargs)
        self.con = con
        self.id = uuid.uuid4().hex
        if isinstance(data, pd.DataFrame):
            self.con.register(self.id, data)
        elif isinstance(data, str):
            self.load_csv_from_url(data)
        self.on_msg(self._handle_custom_msg)

    def load_csv_from_url(self, url: str):
        response = requests.get(url)
        if response.status_code == 200:
            csv_data = response.text
            dataframe = pd.read_csv(StringIO(csv_data))
            self.con.register(self.id, dataframe)
        else:
            raise ValueError(f"Failed to download CSV from URL: {url}")

    def _handle_custom_msg(self, msg: dict, buffers: list):
        logger.debug(f"{msg=}, {buffers=}")
        print("recieved")
        uuid = msg["uuid"]
        sql = msg["sql"]
        command = msg["type"]

        try:
            if command == "arrow":
                result = self.con.query(sql).arrow()
                sink = pa.BufferOutputStream()
                with pa.ipc.new_stream(sink, result.schema) as writer:
                    writer.write(result)
                buf = sink.getvalue()

                self.send({"type": "arrow", "uuid": uuid}, buffers=[buf.to_pybytes()])
            elif command == "exec":
                self.con.execute(sql)
                self.send({"type": "exec", "uuid": uuid})
            elif command == "json":
                result = self.con.query(sql).df()
                json = result.to_dict(orient="records")
                self.send({"type": "json", "uuid": uuid, "result": json})
            else:
                raise ValueError(f"Unknown command {command}")
        except Exception as e:
            logger.exception("Error processing query")
            self.send({"error": str(e), "uuid": uuid})
