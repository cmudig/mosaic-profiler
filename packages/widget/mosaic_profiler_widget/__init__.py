import pathlib
import anywidget
import traitlets
import pandas as pd

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

    dataframe_csv = traitlets.Unicode(allow_none=True).tag(sync=True)

    def __init__(self, dataframe: pd.DataFrame | None = None, *args, **kwargs):
        """Create a DataFrame widget.

        Args:
            dataframe (pd.DataFrame, optional): The initial DataFrame. Defaults to None.
        """
        super().__init__(*args, **kwargs)
        if dataframe is not None:
            self.dataframe_csv = dataframe.to_csv(index=False)
