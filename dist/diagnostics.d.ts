import type { BeaconContext } from './types.js';
export interface WebContextConfig {
    appName: string;
    appVersion: string;
    env: string;
}
export declare function osMajorFromUA(ua?: string): string;
export declare function gatherWebContext(cfg: WebContextConfig): BeaconContext;
