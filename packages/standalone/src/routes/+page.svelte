<script lang="ts">
    import './styles.css';
    //@ts-ignore
    import { onMount, tick } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector, clauseInterval } from '@uwdata/mosaic-core';
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
    let url = '';
    let generatedURL = '';
    let stateString = '';

    async function initializeDatabase() {
        connector = wasmConnector();        
        db = await connector.getDuckDB();
        coordinator().databaseConnector(connector);
    }

    async function handleURL(){
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        db.registerFileText("temp", csvText);
        await coordinator().exec([
            vg.loadCSV(dbId, "temp", { replace: true })
        ]);
        console.log("temp loaded");
        await getInfo();
        
    }

	async function handleFileInput(event: { target: { files: any[]; }; }) {
        url = '';
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

        brush = vg.Selection.crossfilter();
        //@ts-ignore
        columnNames = Array.from(col).map(row => row.column_name);
        //@ts-ignore
        columnTypes = Array.from(type).map(row => row.data_type);

		key += 1;

        await tick()
        updateDisplay(stateString);
    }

    async function updateDisplay(stateString : string) {
        const clients = coordinator().clients;

        const decodedString = decodeURIComponent(stateString);
        const state = JSON.parse(decodedString);

        if(typeof state.brushVal[0] != 'number'){
            state.brushVal = state.brushVal.map((val: string) => new Date(val));
        }
        clients.forEach((client: any) => {
            brush.update(
                clauseInterval(state.brushField, state.brushVal, { source: client })
            );
        });
    }

    function saveAsURL() {
        let brushField = brush.active.predicate._deps[0];
        let brushVal = brush.value;
        console.log(brushVal);
        
        const state = {
            brushField,
            brushVal,
        };

        const jsonString = JSON.stringify(state);
        const encodedJson = encodeURIComponent(jsonString);

        generatedURL = `${window.location.origin}${window.location.pathname}#url=${url}#state=${encodedJson}`;
    }

    onMount(async () => {        
        await initializeDatabase();

        const fullURL = window.location.href;
        if (fullURL.includes('#url') && fullURL.includes('#state')) {
            const hashString = window.location.hash.substring(1); 
            const hashParts = hashString.split('#'); 

            hashParts.forEach(part => {
                if (part.startsWith('url=')) {
                    url = decodeURIComponent(part.substring(4)); 
                } else if (part.startsWith('state=')) {
                    stateString = decodeURIComponent(part.substring(6)); 
                }
            });

            if(url.length > 0){
                await handleURL();
            }
        }
        
        const fileInputElement = document.getElementById('csvFileInput');
        if (fileInputElement) {
            //@ts-ignore
            fileInputElement.addEventListener('input', handleFileInput);
        }
        const urlInputElement = document.getElementById('url-input');
        if (urlInputElement) {
            //@ts-ignore
            urlInputElement.addEventListener('input', handleURL);
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

    <div class="input-container">
        <div class="file-input-wrapper">
            <label class="file-input-label">
                <input type="file" id="csvFileInput" accept=".csv,.parquet"/>
                <span>Upload a file</span>
            </label>
        </div>
        <span class="or-text">or</span>
        <div class="url-input-container">
            <input type="text" class="urlinput" id="url-input" placeholder="Enter URL here" bind:value={url} />
        </div>
    </div>

    <div class="button-container">
        <button on:click={saveAsURL}>Save as URL</button>
    </div>

    {#if generatedURL}
        <div class="url-output">
            <button class="close-button" on:click={() => generatedURL = ''}>×</button>
            <p>Copy this URL:</p>
            <textarea readonly>{generatedURL}</textarea>
            <button class="copy-button" on:click={() => navigator.clipboard.writeText(generatedURL)}>Copy to clipboard</button>
        </div>
    {/if}

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

