<script lang="ts">
    import './styles.css';
    //@ts-ignore
    import { onMount } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import ColumnProfile from './ColumnProfile.svelte';
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';

    let columnNames: string[] = [];
    let columnTypes: string[] = [];

    let connector;
    let db: any;

	let key = 0; 
    var dbId = 't_' + uuidv4().replace(/-/g, '');

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
            } else if(file.name.endsWith(".parquet")){
                await db.registerFileBuffer(
                    file.name,
                    new Uint8Array(await file.arrayBuffer()),
                );
                await coordinator().exec([
			        vg.loadParquet(dbId, file.name, { replace: true })
                ]);
                await getInfo();
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
                        vg.loadCSV(dbId, csvFile.name, { replace: true })
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
            WHERE table_name = '${dbId}'
        `, { cache: false });

        const type = await coordinator().query(`
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = '${dbId}'
        `, { cache: false });

        //@ts-ignore
        columnNames = Array.from(col).map(row => row.column_name);
        //@ts-ignore
        columnTypes = Array.from(type).map(row => row.data_type);

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

<div class="container">
    <div class="header">
        <a class="logo" href="https://idl.uw.edu/mosaic/">
            <img class="VPImage dark" src="mosaic-dark.svg" alt="Mosaic">
            <img class="VPImage light" src="mosaic.svg" alt="Mosaic">
        </a>
    </div>
    <div class="file-input-wrapper">
        <label class="file-input-label">
            <input type="file" id="csvFileInput" accept=".csv,.parquet"/>
            <span>Upload a file</span>
        </label>
    </div>

    {#key key}
    {#if columnNames.length > 0 && brush}
        {#each columnNames as column, index}
            <ColumnProfile
                colName={column}
                type={columnTypes[index]}
                brush={brush}
                dbId={dbId}
            />
        {/each}
    {/if}
    {/key}
</div>

