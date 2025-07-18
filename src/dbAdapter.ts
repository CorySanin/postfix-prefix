import { Model, Sequelize, DataTypes, Op } from 'sequelize';
import type { WhereOptions } from 'sequelize';
import type { AdapterOptions } from './config.ts';

const RELAY_TABLE = 'relays';
const USER_TABLE = 'users'
const DOMAIN_TABLE = 'domains'

class UserRecord extends Model {
    id: number;
    oidc: string;
    displayname: string;
    admin: boolean;
}

class RelayRecord extends Model {
    id: number;
    user: number;
    description: string;
    enabled: boolean;
    softDeleted: boolean;
    alias: string;
    destination: string;
    whitelist: string[];
}

class DomainRecord extends Model {
    name: string;
    owner: number;
}

class DbAdapter {
    private userModel: typeof UserRecord;
    private relayModel: typeof RelayRecord;
    private domainModel: typeof DomainRecord;
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
            displayname: { type: DataTypes.STRING(128), allowNull: false, unique: false },
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
            description: { type: DataTypes.TEXT, defaultValue: '' },
            enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
            softDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
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
        this.domainModel = sequelize.define(DOMAIN_TABLE, {
            name: { type: DataTypes.STRING(128), primaryKey: true},
            owner: {
                type: DataTypes.INTEGER, references: {
                    model: this.userModel,
                    key: 'id'
                }
            }
        });
        this.syncModels();
    }

    async syncModels(): Promise<void> {
        await this.userModel.sync();
        await this.relayModel.sync();
        await this.domainModel.sync();
    }

    getAllUsers(): Promise<UserRecord[]> {
        return this.userModel.findAll();
    }

    getUserById(id: number): Promise<UserRecord | null> {
        return this.userModel.findByPk(id);
    }

    async getUserByOIDC(id: string, displayname: string): Promise<UserRecord> {
        const [user, created] = await this.userModel.findOrCreate({
            where: {
                oidc: id
            },
            defaults: {
                displayname
            },
        });
        if (!created && user.displayname !== displayname) {
            await this.setDisplayName(user.id, user.displayname = displayname);
        }
        else if (created && user.id === 1) {
            await this.setAdmin(user.id, user.admin = true);
        }
        return user;
    }

    setDisplayName(id: number, displayname: string): Promise<[number]> {
        return this.userModel.update({
            displayname
        }, {
            where: { id }
        });
    }

    setAdmin(id: number, isAdmin: boolean): Promise<[number]> {
        return this.userModel.update({
            admin: isAdmin
        }, {
            where: { id }
        });
    }

    getAllRelays(showDisabled: boolean = false): Promise<RelayRecord[]> {
        return this.relayModel.findAll(showDisabled ? {} : {
            where: {
                enabled: true,
                softDeleted: false
            }
        });
    }

    getRelays(showDisabled: boolean = false, startingId: number = 0, limit: number = 100): Promise<RelayRecord[]> {
        const whereclause: WhereOptions<RelayRecord> = {
            id: {
                [Op.gt]: startingId
            }
        }
        if (!showDisabled) {
            whereclause.enabled = true;
            whereclause.softDeleted = false;
        }
        return this.relayModel.findAll({
            where: whereclause,
            limit
        });
    }

    getUsersRelays(user: number | UserRecord): Promise<RelayRecord[]> {
        const id = typeof user === 'number' ? user : user.id;
        return this.relayModel.findAll({
            where: {
                user: id,
                softDeleted: false
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

    getMyDomains(user: number | UserRecord) : Promise<DomainRecord[]> {
        const owner = typeof user === 'number' ? user : user.id;
        return this.domainModel.findAll({
            where: {
                [Op.or]: [
                    {
                        owner: -1
                    },
                    {
                        owner
                    }
                ]
            }
        });
    }

    createDomain(domain: string, user: number | UserRecord = -1) {
        const owner = typeof user === 'number' ? user : user.id;
        return this.domainModel.create({
            name: domain,
            owner
        });
    }

    deleteDomain(domain: string, user: number | UserRecord) {
        const owner = typeof user === 'number' ? user : user.id;
        return this.domainModel.destroy({
            where: {
                name: domain,
                owner
            }
        });
    }

    close(): Promise<void> {
        return this.sequelize.close();
    }
}

export default DbAdapter;
export { DbAdapter };
export type { UserRecord, RelayRecord };
