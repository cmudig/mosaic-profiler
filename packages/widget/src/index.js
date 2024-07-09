// @ts-ignore
import Counter from "./profiler_widget.svelte";

export function render({ model, el }) {
	let df_csv = model.get("dataframe_csv");
	let counter = new Counter({ target: el, props: { model, df_csv } });
	return () => counter.$destroy();
}