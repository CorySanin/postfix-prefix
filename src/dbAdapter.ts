import { Model, Sequelize, DataTypes, Op } from 'sequelize';

const RELAY_TABLE = 'relays';
const USER_TABLE = 'users'

type AdapterOptions = {
    uri: string;
}

class UserRecord extends Model {
    id: number;
    oidc: string;
    admin: boolean;
}

class RelayRecord extends Model {
    id: number;
    user: number;
    description: string;
    enabled: boolean;
    alias: string;
    destination: string;
    whitelist: string[];
}

class DbAdapter {
    private userModel: typeof UserRecord;
    private relayModel: typeof RelayRecord;
    private sequelize: Sequelize;

    constructor(options: Partial<AdapterOptions> = {}) {
        const uri = process.env.DBURI || options.uri;
        if (!uri) {
            throw new Error('DbAdapter requires a URI.');
        }
        const sequelize = this.sequelize = new Sequelize(uri);
        this.userModel = sequelize.define(USER_TABLE, {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            oidc: { type: DataTypes.STRING(128), allowNull: false, unique: true },
            admin: { type: DataTypes.BOOLEAN, defaultValue: false }
        });
        this.relayModel = sequelize.define(RELAY_TABLE, {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            user: {
                type: DataTypes.INTEGER, references: {
                    model: this.userModel,
                    key: 'id'
                }
            },
            description: { type: DataTypes.TEXT, defaultValue: ''},
            enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
            alias: { type: DataTypes.STRING(128), allowNull: false, unique: true },
            destination: { type: DataTypes.STRING(128), allowNull: false, unique: false },
            whitelist: {
                type: DataTypes.TEXT, defaultValue: '[]', get: function (this: RelayRecord) {
                    return JSON.parse(this.getDataValue('whitelist') as string);
                }, set: function (this: RelayRecord, val: string[]) {
                    this.setDataValue('whitelist', JSON.stringify(val));
                }
            }
        });
        this.syncModels();
    }

    async syncModels(): Promise<void> {
        await this.userModel.sync();
        await this.relayModel.sync();
    }

    getAllUsers(): Promise<UserRecord[]> {
        return this.userModel.findAll();
    }

    getUserById(id: number): Promise<UserRecord | null> {
        return this.userModel.findByPk(id);
    }

    async getUserByOIDC(id: string): Promise<UserRecord> {
        const [user, created] = await this.userModel.findOrCreate({
            where: {
                oidc: id
            }
        });
        if (created && user.id === 1) {
            await this.setAdmin(user.id, user.admin = true);
        }
        return user;
    }

    setAdmin(id: number, isAdmin: boolean): Promise<[number]> {
        return this.userModel.update({
            admin: isAdmin
        }, {
            where: { id }
        });
    }

    getAllRelays(): Promise<RelayRecord[]> {
        return this.relayModel.findAll();
    }

    getRelays(startingId: number = 0, limit: number = 100): Promise<RelayRecord[]> {
        return this.relayModel.findAll({
            where: {
                id: {
                    [Op.gt]: startingId
                }
            },
            limit
        });
    }

    getUsersRelays(user: number | UserRecord): Promise<RelayRecord[]> {
        const id = typeof user === 'number' ? user : user.id;
        return this.relayModel.findAll({
            where: {
                user: id
            }
        });
    }

    getRelayByAlias(alias: string): Promise<RelayRecord | null> {
        return this.relayModel.findOne({
            where: {
                alias
            }
        });
    }

    updateRelay(relay: Partial<RelayRecord>): Promise<[number]> {
        return this.relayModel.update(relay, {
            where: {
                id: relay.id
            }
        });
    }

    createRelay(relay: Partial<RelayRecord>) {
        if (relay.id) {
            delete relay.id;
        }
        return this.relayModel.create(relay);
    }

    close(): Promise<void> {
        return this.sequelize.close();
    }
}

export default DbAdapter;
export { DbAdapter };
export type { AdapterOptions, UserRecord, RelayRecord };
