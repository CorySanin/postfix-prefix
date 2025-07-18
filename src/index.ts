import { DbAdapter } from './dbAdapter.ts';
import { STDIO } from './stdio.ts';
import { getConfig } from './config.ts';

const config = await getConfig();
const db: DbAdapter = new DbAdapter(config.db || {});
await (new STDIO(config)).writeConf();

process.on('SIGTERM', () => {
    db.close();
});
