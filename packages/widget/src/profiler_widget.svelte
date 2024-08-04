<script lang="ts">
    //@ts-ignore
    import { onMount } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import ColumnProfile from "./WidgetColumnProfile.svelte";
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';

    export let id: string;
    export let connector: any;
    let columnNames: string[] = [];
    let columnTypes: string[] = [];

    let key = 0; 
    let brush: any;
    
    function initializeDatabase() {
        coordinator().databaseConnector(connector);    
    }

    async function getInfo(name: string) {
        const col = await coordinator().query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '${name}'`);
        const type = await coordinator().query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = '${name}'`);
        //@ts-ignore
        columnNames = Array.from(col).map(row => row.column_name);
        //@ts-ignore
        columnTypes = Array.from(type).map(row => row.data_type);

        key += 1;

        brush = vg.Selection.crossfilter();
    }

    onMount(async () => {
        initializeDatabase();
        await getInfo(id);
    });
</script>

<style>
    .container {
        align-items: center;
        width: 400px;
    }
</style>

<div class="container">
    {#key key}
    {#if columnNames.length > 0 && brush}
        {#each columnNames as column, index}
            <ColumnProfile
                colName={column}
                type={columnTypes[index]}
                brush={brush}
                dbId={id}
            />
        {/each}
    {/if}
    {/key}
</div>

