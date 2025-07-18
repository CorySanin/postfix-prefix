import path from 'path';
import fsp from 'fs/promises';
import json5 from 'json5';

type AppConfig = {
    db: Partial<AdapterOptions>;
    STDIO: Partial<STDIOOptions>;
    postfix: Partial<PostfixOptions>;
}

type AdapterOptions = {
    uri: string;
}

type STDIOOptions = {
    postfixConfPath: string;
    policySock: string;  // unused until a good fuse package exists
}

type PostfixOptions = {
    hostname: string;
}

async function readConfig(): Promise<Partial<AppConfig>> {
    try {
        return json5.parse((await fsp.readFile(process.env.CONFIG || path.join('config', 'config.json5'))).toString());
    }
    catch (err) {
        console.error(err);
        return {};
    }
}

async function getConfig() {
    const options = await readConfig()
    const conf: AppConfig = {
        db: {
            uri: process.env.DBURI || options.db?.uri
        },
        STDIO: {
            postfixConfPath: process.env.POSTFIXCONFPATH || options.STDIO?.postfixConfPath,
            policySock: process.env.POLICYSOCK || options.STDIO?.policySock
        },
        postfix: {
            hostname: process.env.POSTHOSTNAME || options.postfix?.hostname,
        }
    }
    return conf;
}

export default getConfig;
export { getConfig };
export type { AppConfig, AdapterOptions, STDIOOptions, PostfixOptions };
