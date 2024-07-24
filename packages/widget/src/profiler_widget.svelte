<script lang="ts">
    //@ts-ignore
    import { onMount } from 'svelte';
    //@ts-ignore
    import { coordinator, wasmConnector } from '@uwdata/mosaic-core';
    //@ts-ignore
    import * as vg from '@uwdata/vgplot';
    //@ts-ignore
    import ColumnProfile from "mosaic-profiler-standalone/routes/ColumnProfile.svelte";
    //@ts-ignore
    import { v4 as uuidv4 } from 'uuid';

    export let df_csv: string;
    let columnNames: string[] = [];
    let columnTypes: string[] = [];
    

    let connector : any;
    let db: any = null;

    var dbId = 't_' + uuidv4().replace(/-/g, '');
    let brush: any;
	
    async function initializeDatabase() {
        if(!db){
            connector = wasmConnector();        
            db = await connector.getDuckDB();
            coordinator().databaseConnector(connector);
        }
    }

    function csvStringToFile(csvString: string, fileName: string): File {
        const blob = new Blob([csvString], { type: 'text/csv' });
        const file = new File([blob], fileName, { type: 'text/csv' });
        return file;
    }

    async function loadCSVToDuckDB(csvFile: File) {
        if (csvFile) {
            var reader = new FileReader();
            reader.readAsText(csvFile, "UTF-8");
            reader.onload = async function (evt) {
                if (evt.target) {
                    const result = evt.target.result as string;
                    await db.registerFileText(csvFile.name, result);
                    await coordinator().exec([
                        vg.loadCSV(dbId, csvFile.name, { replace: false })
                    ]);
                    console.log(csvFile.name + " loaded");

                    console.log(`CSV file ${csvFile.name} registered as ${dbId}`);

                    // Verify table creation
                    const tables = await coordinator().query("SHOW TABLES;", {cache: false});
                    //@ts-ignore
                    const tableNames = [];
                    for (let i = 0; i < tables.numRows; i++) {
                        tableNames.push(tables.get(i).toArray()[0]);
                    }
                    console.log("Tables:", tableNames);
                    await getInfo(dbId);
                }
            }
        }
    }

    async function getInfo(tableName: string) {
      const col = await coordinator().query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
      `, { cache: false });

      const type = await coordinator().query(`
          SELECT data_type
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
      `, { cache: false });

      //@ts-ignore
      columnNames = Array.from(col).map(row => row.column_name);
      //@ts-ignore
      columnTypes = Array.from(type).map(row => row.data_type);

      brush = vg.Selection.crossfilter();
    }

    onMount(async () => {
        await initializeDatabase();
        await loadCSVToDuckDB(csvStringToFile(df_csv, `${dbId}.csv`));
    });
</script>

<div>
    {#if columnNames.length > 0 && brush}
        {#each columnNames as column, index}
            <ColumnProfile
              colName={column}
              type={columnTypes[index]}
              brush={brush}
              dbId={dbId}
		    />
        {/each}
    {:else if columnNames === undefined} <!-- Show loading state -->
        <p>Loading...</p>
    {:else} <!-- Handle empty case -->
        <p class="pl-8">No columns!</p>
    {/if}
</div>
