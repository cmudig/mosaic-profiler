<script lang="ts">
    //@ts-ignore
    import { onMount } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import ColumnProfile from './ColumnProfile.svelte';

    let columnNames: string[] = [];
    let columnTypes: string[] = [];

    let connector;
    let db: any;

	let key = 0; 

	let brush: any;
	
    async function initializeDatabase() {
        connector = wasmConnector();        
        db = await connector.getDuckDB();
        coordinator().databaseConnector(connector);
    }

	async function handleFileInput(event: { target: { files: any[]; }; }) {
        const file = event.target.files[0];
        if (file) {
			if (file.type === 'text/csv') {
            	loadCSVToDuckDB(file);
            //} else {
            
            }
        }
    }

    function loadCSVToDuckDB(csvFile: File) {
        if (csvFile) {
            var reader = new FileReader();
            reader.readAsText(csvFile, "UTF-8");
            reader.onload = async function (evt) {
                if (evt.target) {
                    const result = evt.target.result as string;
                    db.registerFileText(csvFile.name, result);
                    await coordinator().exec([
                        vg.loadCSV("dataprof", csvFile.name, { replace: true })
                    ]);
                    console.log(csvFile.name + " loaded");
                    await getInfo();
                }
            }
        }
    }

    async function getInfo() {
        const col = await coordinator().query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'dataprof'
        `, { cache: false });

        const type = await coordinator().query(`
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = 'dataprof'
        `, { cache: false });

        //@ts-ignore
        columnNames = Array.from(col).map(row => row.column_name);
        //@ts-ignore
        columnTypes = Array.from(type).map(row => row.data_type);

        console.log(columnNames);
        console.log(columnTypes);

		key += 1;
		brush = vg.Selection.crossfilter();
    }

    onMount(async () => {
        await initializeDatabase();
        
        const element = document.getElementById('csvFileInput');
        if (element) {
            //@ts-ignore
            element.addEventListener('input', handleFileInput);
        }
    });
</script>

<div>
    <input type="file" id="csvFileInput" accept=".csv,.parquet"/>

	{#key key}
    {#if columnNames.length > 0 && brush}
        {#each columnNames as column, index}
            <ColumnProfile
                colName={column}
                type={columnTypes[index]}
				brush={brush}
			/>
        {/each}
    {:else if columnNames === undefined} <!-- Show loading state -->
        <p>Loading...</p>
    {:else} <!-- Handle empty case -->
        <p class="pl-8">No columns!</p>
    {/if}
	{/key}
</div>
