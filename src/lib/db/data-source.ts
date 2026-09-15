/** A safe, machine-readable failure for a required data source. */
export class DataSourceUnavailableError extends Error {
    public readonly code: string;
    constructor(message = 'Required data source is unavailable.', code = 'data_source_unavailable') {
        super(message);
        this.code = code;
        this.name = 'DataSourceUnavailableError';
    }
}
