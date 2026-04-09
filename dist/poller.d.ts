import { ApiClient } from './client';
import { DeployStatus } from './types';
export interface PollResult {
    status: DeployStatus;
    workflowId?: string;
    errorMessage?: string;
}
export declare class Poller {
    private client;
    private interval;
    private timeout;
    constructor(client: ApiClient, interval: number, timeout: number);
    poll(deployId: string): Promise<PollResult>;
    private sleep;
}
//# sourceMappingURL=poller.d.ts.map