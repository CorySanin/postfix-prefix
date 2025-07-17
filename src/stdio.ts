import path from 'path';
import fs from 'fs';
import type { DbAdapter } from './dbAdapter.ts';

type STDIOOptions = {
    virtualPath: string;
    virtualSock: string; // unused until a good fuse package exists
    policySock: string;  // unused until a good fuse package exists
}

class STDIO {
    private db: DbAdapter;
    private virtualPath: string;

    constructor(config: Partial<STDIOOptions>, db: DbAdapter) {
        this.virtualPath = process.env.VIRTUALPATH || config.virtualPath || path.join('etc', 'postfix', 'virtual');
        this.db = db;
    }

    async writeVirtualConfig(): Promise<void> {
        const outputStream = fs.createWriteStream(this.virtualPath, { flags: 'w' });
        let lastId = 0;
        let relays = await this.db.getRelays(false, lastId) || [];
        while (relays.length) {
            relays.forEach(r => {
                outputStream.write(`${r.alias}   ${r.destination}`);
                lastId = r.id;
            });
            relays = await this.db.getRelays(false, lastId);
        }
        outputStream.end(() => {
            console.info('Finished writing virtual file');
        });
    }
}

export default STDIO;
export { STDIO };
export type { STDIOOptions };
