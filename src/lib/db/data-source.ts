/** A safe, machine-readable failure for a required data source. */
export class DataSourceUnavailableError extends Error {
    constructor(
        message = 'Required data source is unavailable.',
        public readonly code = 'data_source_unavailable',
    ) {
        super(message);
        this.name = 'DataSourceUnavailableError';
    }
}
