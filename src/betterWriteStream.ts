import fs from 'fs';
import fsp from 'fs/promises';

interface StreamOptions {
    flags?: string | undefined;
    encoding?: BufferEncoding | undefined;
    fd?: number | fsp.FileHandle | undefined;
    mode?: number | undefined;
    autoClose?: boolean | undefined;
    emitClose?: boolean | undefined;
    start?: number | undefined;
    signal?: AbortSignal | null | undefined;
    highWaterMark?: number | undefined;
}
interface FSImplementation {
    open?: (...args: any[]) => any;
    close?: (...args: any[]) => any;
}
interface CreateWriteStreamFSImplementation extends FSImplementation {
    write: (...args: any[]) => any;
    writev?: (...args: any[]) => any;
}
interface WriteStreamOptions extends StreamOptions {
    fs?: CreateWriteStreamFSImplementation | null | undefined;
    flush?: boolean | undefined;
}

class BetterWriteStream {

    private stream: fs.WriteStream;

    constructor(path: fs.PathLike, options?: BufferEncoding | WriteStreamOptions) {
        this.stream = fs.createWriteStream(path, options);
    }

    write(chunk: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const wantDrain = this.stream.write(chunk, async (err) => {
                if (err) {
                    return reject(err);
                }
                if (wantDrain) {
                    await this.waitForDrain();
                }
                resolve();
            })
        });
    }

    end(): Promise<void> {
        return new Promise((resolve, _) => {
            this.stream.end(resolve);
        });
    }

    private waitForDrain(): Promise<void> {
        return new Promise((resolve, _) => {
            if (!this.stream.writableNeedDrain) {
                return resolve();
            }
            const cb = () => {
                this.stream.off('drain', cb);
                resolve();
            }
            this.stream.on('drain', cb);
        });
    }
}

export default BetterWriteStream;
export { BetterWriteStream };
export type { WriteStreamOptions, CreateWriteStreamFSImplementation, FSImplementation, StreamOptions }
