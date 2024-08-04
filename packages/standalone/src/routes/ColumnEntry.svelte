<main>
    <div class="table-container">
        <div class="left-column">
            <slot name="left"></slot>
        </div>
        <div class="right-column">
            <slot name="right"></slot>
        </div>
    </div>
</main>

<style>
    .table-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 12px;
        width: 100%; 
        max-width: 500px; 
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        box-sizing: border-box; 
        font-family: -apple-system, BlinkMacSystemFont, "avenir next", avenir, helvetica, "helvetica neue", ubuntu, roboto, noto, "segoe ui", arial, sans-serif;
    }

    .left-column {
        flex: 1 1 auto; 
        min-width: 150px;
        padding-right: 6px; 
    }

    .right-column {
        flex: 0 1 auto;
        padding-left: 6px; 
        text-align: right;
        padding-left: 6px; 
    }

    @media (max-width: 768px) {
        .table-container {
            width: 100%; 
        }
    }
</style>