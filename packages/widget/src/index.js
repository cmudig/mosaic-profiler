import Widget from "./profiler_widget.svelte";
import { v4 as uuidv4 } from 'uuid';
import * as arrow from 'apache-arrow';
import { coordinator } from '@uwdata/mosaic-core';

export default{
  /** @param {{ model: DOMWidgetModel, el: HTMLElement }} context */
  render({el, model}) {
    const logger = coordinator().logger();
    /** @type Map<string, {query: Record<any, unknown>, resolve: (value: any) => void, reject: (reason?: any) => void}> */
    const openQueries = new Map();

        /**
     * @param {Record<any, unknown>} query the query to send
     * @param {(value: any) => void} resolve the promise resolve callback
     * @param {(reason?: any) => void} reject the promise reject callback
     */
    function send(query, resolve, reject) {
      const uuid = uuidv4();
    
      openQueries.set(uuid, {
        query,
        resolve,
        reject,
      });
      model.send({ ...query, uuid: uuid }, []);
      console.log("sent", { ...query, uuid: uuid });
    }
    
    const connector = {
      query(query) {
        return new Promise((resolve, reject) => send(query, resolve, reject));
      },
    };

    const initializeWidget = () => {
        let id = model.get("id");
        let widget = new Widget({ target: el, props: { id, connector } });
        return widget;
      };
  
    let widget = initializeWidget();

    model.on("msg:custom", (msg, buffers) => {
      logger.group(`query ${msg.uuid}`);
      logger.log('received message', msg, buffers);
      const query = openQueries.get(msg.uuid);
      openQueries.delete(msg.uuid);
    
      if (msg.error) {
        query.reject(msg.error);
        logger.error(msg.error);
      } else {
        switch (msg.type) {
          case 'arrow': {
            const table = arrow.tableFromIPC(buffers[0].buffer);
            logger.log('table', table);
            query.resolve(table);
            break;
          }
          case 'json': {
            logger.log('json', msg.result);
            query.resolve(msg.result);
            break;
          }
          default: {
            query.resolve({});
            break;
          }
        }
      }
    });
    return () => widget.$destroy();
  }
}
