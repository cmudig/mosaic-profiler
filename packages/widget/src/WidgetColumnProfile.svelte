<script lang="ts">
    //@ts-ignore
    import ColumnEntry from 'mosaic-profiler-standalone/routes/ColumnEntry.svelte';
    //@ts-ignore
	import { onMount } from 'svelte';
    //@ts-ignore
    import { coordinator } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';

    export let colName: string;
    export let type: string;
    export let brush: any;
    export let dbId: string;
    var uniqueId = `plot-${uuidv4()}`;

    async function getPlot() {
        if (type == 'DOUBLE' || type == 'BIGINT' || type == 'TINYINT') {
            const data = await coordinator().query(`
                SELECT 
                    CASE 
                        WHEN MIN("${colName}") = MAX("${colName}") THEN 'same'
                        ELSE 'distinct'
                    END AS result
                FROM "${dbId}"
            `, { cache: false });
            //@ts-ignore
            const res = Array.from(data)[0].result;

            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                if(res === 'distinct'){
                    element.replaceChildren(vg.vconcat(vg.plot(
                        vg.rectY(
                            vg.from(dbId, { filterBy: brush }),
                            { x: vg.bin(colName), y: vg.count(), fill: "steelblue", inset: 0.5 }
                        ),
                        vg.intervalX({ as: brush }),
                        vg.xDomain(vg.Fixed),
                        vg.yTickFormat("s"),
                        vg.width(400),
                        vg.height(100)
                    )));
                } else {
                    element.replaceChildren(vg.vconcat(vg.plot(
                        vg.rectY(
                            vg.from(dbId, { filterBy: brush }),
                            { x: colName, y: vg.count(), fill: "steelblue", inset: 0.5 }
                        ),
                        vg.intervalX({ as: brush }),
                        vg.xDomain(vg.Fixed),
                        vg.yTickFormat("s"),
                        vg.width(400),
                        vg.height(100)
                    )));
                }
            }
        } else if (type == 'DATE') {
            const data = await coordinator().query(`
                SELECT "${colName}"
                FROM "${dbId}"
            `, { cache: false });
            //@ts-ignore
            const dates = Array.from(data).map(d => new Date(d[colName]).getTime());
            const min = new Date(Math.min(...dates));
            const max = new Date(Math.max(...dates));
            //@ts-ignore
            const days = (max - min) / (1000 * 60 * 60 * 24);

            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                //check if less than 40 years 
                if(days <= 14610){
                    element.replaceChildren(vg.vconcat(vg.plot(
                        vg.lineY(
                            vg.from(dbId, { filterBy: brush }),
                            { x: vg.bin(colName), y: vg.count(), stroke: "steelblue", inset: 0.5}
                        ),
                        vg.intervalX({ as: brush }),
                        vg.width(400),
                        vg.height(100),

                    )));
                } else{
                    element.replaceChildren(vg.vconcat(vg.plot(
                        vg.lineY(
                            vg.from(dbId, { filterBy: brush }),
                            { x: vg.bin(colName, {interval: "year", steps: 1}), y: vg.count(), stroke: "steelblue", inset: 0.5}
                        ),
                        vg.intervalX({ as: brush }),
                        vg.width(400),
                        vg.height(100),
                    )));
                }
            }
        } else if (type == 'VARCHAR'){
            const element = document.querySelector(`#${uniqueId}`);
            if (element) {
                element.replaceChildren(vg.vconcat(vg.plot(
                    vg.barY(
                        vg.from(dbId),
                        { x: colName, y: vg.count(), fill: "steelblue", inset: 0.5, sort: {x: "-y", limit: 2}}
                    ),
                    vg.width(400),
                    vg.height(100),
                )));
            }
        }
    }

    onMount(async () => {
        await getPlot();
    });
</script>

<ColumnEntry>
    <svelte:fragment slot="right">
        <div id="{uniqueId}"></div>
    </svelte:fragment>

	<svelte:fragment slot="left">
		<span>{colName}</span>
	</svelte:fragment>
</ColumnEntry>


