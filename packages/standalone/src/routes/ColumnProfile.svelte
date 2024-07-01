<script lang="ts">
    import MyComponent from './ColumnEntry.svelte';
    //@ts-ignore
	import { onMount} from 'svelte';
    //@ts-ignore
    import { coordinator } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';

    export let colName: string;
    export let type: string;
    export let brush: any;
    var uniqueId = `plot-${uuidv4()}`;

    async function getPlot() {
        if (type == 'DOUBLE' || type == 'BIGINT') {
            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                element.replaceChildren(vg.vconcat(vg.plot(
                    vg.rectY(
                        vg.from("dataprof", { filterBy: brush }),
                        { x: vg.bin(colName), y: vg.count(), fill: "steelblue", inset: 0.5 }
                    ),
                    vg.intervalX({ as: brush }),
                    vg.xDomain(vg.Fixed),
                    vg.yTickFormat("s"),
                    vg.width(500),
                    vg.height(80)
                )));
            }
        } else if (type == 'DATE') {
            const countOfEachDate = await coordinator().query(`
                SELECT ${colName}, COUNT(*) AS count
                FROM dataprof
                GROUP BY ${colName}
            `, { cache: false });

            //@ts-ignore
            const counts = Array.from(countOfEachDate).map(row => row.count);

            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                element.replaceChildren(vg.vconcat(vg.plot(
                    vg.areaY(
                        vg.from("dataprof", { filterBy: brush }),
                        { x: colName, y: counts, fill: "steelblue", inset: 0.5 }
                    ),
                    vg.intervalX({ as: brush }),
                    vg.width(500),
                    vg.height(80),
                )));
            }
        } else if (type == 'VARCHAR'){
            const countOfEachCategory = await coordinator().query(`
                SELECT ${colName}, COUNT(*) AS frequency
                FROM dataprof
                WHERE ${colName} IS NOT NULL
                GROUP BY ${colName}
                ORDER BY frequency DESC
                LIMIT 2;
            `, { cache: false });

            //@ts-ignore
            const counts = Array.from(countOfEachCategory).map(row => row.frequency);

            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                element.replaceChildren(vg.vconcat(vg.plot(
                    vg.barY(
                        vg.from("dataprof"),
                        { x: colName, y: counts, fill: "steelblue", inset: 0.5, sort: {x: "-y", limit: 2}}
                    ),
                    vg.width(500),
                    vg.height(80),
                )));
            }
        }
    }

    onMount(async () => {
        await getPlot();
    });
</script>

<MyComponent>
    <svelte:fragment slot="right">
        <div id="{uniqueId}"></div>
    </svelte:fragment>

	<svelte:fragment slot="left">
		<span>{colName}</span>
	</svelte:fragment>
</MyComponent>


