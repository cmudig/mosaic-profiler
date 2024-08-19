<script lang="ts">
    import './styles.css';
    //@ts-ignore
    import { onMount, tick } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector, clauseIntervals, clausePoint } from '@uwdata/mosaic-core';
    //@ts-ignore
    import { and, isNotDistinct, literal } from '@uwdata/mosaic-sql';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import ColumnProfile from './ColumnProfile.svelte';
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';
    //@ts-ignore
    import debounce from 'lodash/debounce';
    //@ts-ignore
    import { pushState } from '$app/navigation';

    let columnNames: string[] = [];
    let columnTypes: string[] = [];

    let connector;
    let db: any;

    let key = 0; 
    var dbId = 't_' + uuidv4().replace(/-/g, '');

    let brush: any;
    let click: any;
    let url = '';
    let generatedURL;
    let stateString = '';
    let displayUpdated = false;

    async function initializeDatabase() {
        connector = wasmConnector();        
        db = await connector.getDuckDB();
        coordinator().databaseConnector(connector);
    }

    function clausePoints(fields, value, {
        source,
        clients = source ? new Set([source]) : undefined
    }) {
        /** @type {SQLExpression | null} */
        let predicate = null;
        if (value) {
            const list = value.map((v, i) => {
                const quotedValue = typeof v === 'object' ? `${v}` : v;
                return isNotDistinct(fields[i], literal(quotedValue));
            });
            predicate = list.length > 1 ? and(list) : list[0];
        }
        return {
            meta: { type: 'point' },
            source,
            clients,
            value,
            predicate
        };
    }

    async function handleURL(){
        const response = await fetch(url);
        if(url.endsWith(".csv")){
            if (!response.ok) {
                throw new Error(`Error fetching CSV: ${response.statusText}`);
            }
            const csvText = await response.text();
            db.registerFileText("csv", csvText);
            await coordinator().exec([
                vg.loadCSV(dbId, "csv", { replace: true })
            ]);
            console.log("CSV loaded from URL");            
        } else if(url.endsWith(".parquet")){
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            await db.registerFileBuffer('parquet', uint8Array);
            await coordinator().exec([
                vg.loadParquet(dbId, "parquet", { replace: true })
            ]);
        }

        await getInfo();
        !window.location.href.includes("#url") ? 
        pushState(`${window.location.origin}${window.location.pathname}#url=${url}`)
        : {};
        
    }

    async function handleFileInput(event: { target: { files: any[]; }; }) {
        if(url.length > 0){
            url = '';
            pushState(window.location.pathname);   
        }

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
        click = vg.Selection.single({cross: true});
        //@ts-ignore
        columnNames = Array.from(col).map(row => row.column_name);
        //@ts-ignore
        columnTypes = Array.from(type).map(row => row.data_type);

        key += 1;

        await tick();
        if(stateString.length > 0 && !displayUpdated){
            updateDisplay(stateString);
            displayUpdated = true;
        }
    }

    async function updateDisplay(stateString : string) {
        const clients = coordinator().clients;

        const state = JSON.parse(stateString);

        for (let i = 0; i < state.intervalVal.length; i++) {
            if(state.intervalVal[i].some(item => typeof item === 'string')){
                state.intervalVal[i] = state.intervalVal[i].map((val: string) => new Date(val));
            }
        }

        await clients.forEach(async client => {
            if(state.pointVal.length > 0){  
                await brush.update(
                    clausePoints(state.pointField, state.pointVal, {}),
                );    
                      
            }

            if(state.intervalVal.length > 0){
                await brush.update(
                    clauseIntervals(state.intervalField, state.intervalVal, { source: client })
                );
            }
        });
    }

    function saveAsURL() {
        try{
            if (!brush.clauses[0].source) {
                generatedURL = window.location.href;
                return;
            }

            let pointField = [];
            let pointVal = [];

            let intervalField = [];
            let intervalVal = [];
            let p = 0;
            let i = 0;

            brush.clauses.forEach((clause) => {
                if(clause.value.length == 1){
                    pointVal[p] = clause.value[0];
                    pointField[p] = (clause.source && clause.source.as) ? clause.source.as[0] : clause.source.field;
                    p++;
                } else if(clause.value.length > 1) {
                    intervalVal[i] = clause.value;
                    intervalField[i] = (clause.source && clause.source.as) ? clause.source.as[0] : clause.source.field;
                    i++;
                }
            });

            const state = {
                pointField,
                pointVal,
                intervalField,
                intervalVal
            };

            const jsonString = JSON.stringify(state);
            const encodedJson = encodeURIComponent(jsonString);

            if(!pointField.includes(undefined) && !intervalField.includes(undefined)){
                generatedURL = `${window.location.origin}${window.location.pathname}#url=${url}#state=${encodedJson}`;            
            }
        } catch(error){
            console.log(error);
            console.log("No URL update");
        }
    }

    const debouncedPushState = debounce(pushState, 200);

    onMount(async () => {   
        displayUpdated = false;
        generatedURL = window.location.href;
        document.title = "Mosaic Profiler";
        const wasReloaded = sessionStorage.getItem('reloaded') === 'true';

        if (wasReloaded) {
            url = '';
            stateString = '';
            window.history.pushState(null, "", window.location.pathname);
            sessionStorage.removeItem('reloaded');
        }
        window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('reloaded', 'true');
        });

        await initializeDatabase();

        async function handlePopState() {
            const fullURL = window.location.href;
            if (fullURL.includes('#url') || fullURL.includes('#state')) {
                const hashString = window.location.hash.substring(1); 
                const hashParts = hashString.split('#'); 

                hashParts.forEach(part => {
                    if (part.startsWith('url=')) {
                        url = decodeURIComponent(part.substring(4)); 
                    } else if (part.startsWith('state=')) {
                        stateString = decodeURIComponent(part.substring(6)); 
                    }
                });

                if (url.length > 0) {
                    await handleURL();
                }

                if (stateString.length > 0) {
                    updateDisplay(stateString);
                }
            }
        }

        window.addEventListener('popstate', handlePopState);

        handlePopState();

        const targetNode = document.getElementById('profiler');

        const config = {
            childList: true, 
            attributes: true, 
            subtree: true,    
            characterData: true 
        };

        const callback = function(mutationsList: any, observer: any) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' || mutation.type === 'childList' && brush._resolved.length > 0) {
                    saveAsURL();
                    debouncedPushState(generatedURL);
                } 
                else if(mutation.type === 'attributes'){
                    stateString = "";
                    url.length > 0 ? 
                    debouncedPushState(`${window.location.origin}${window.location.pathname}#url=${url}`) 
                    : debouncedPushState(window.location.pathname);
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);

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

    <div id="profiler">
        {#key key}
        {#if columnNames.length > 0 && brush}
            {#each columnNames as column, index}
                <ColumnProfile
                    colName={column}
                    type={columnTypes[index]}
                    brush={brush}
                    click={click}
                    dbId={dbId}
                />
            {/each}
        {/if}
        {/key}
    </div>
</div>