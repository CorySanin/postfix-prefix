import path from 'path';
import fsp from 'fs/promises';
import json5 from 'json5';
import { DbAdapter } from './dbAdapter.ts';
import { STDIO } from './stdio.ts';
import type { AdapterOptions } from './dbAdapter.ts';
import type { STDIOOptions } from './stdio.ts';

type Config = {
    db: AdapterOptions;
    STDIO: STDIOOptions;
}

async function getConfig(): Promise<Partial<Config>> {
    try {
        return json5.parse((await fsp.readFile(process.env.CONFIG || path.join('config', 'config.json5'))).toString());
    }
    catch (err) {
        console.error(err);
        return {};
    }
}

const config = await getConfig();
const db: DbAdapter = new DbAdapter(config.db || {});
const stdio: STDIO = new STDIO(config.STDIO || {}, null);

process.on('SIGTERM', () => {
    db.close();
});
