import path from 'path';
import { parse } from 'pg-connection-string';
import { BetterWriteStream } from './betterWriteStream.ts';
import type { DbAdapter } from './dbAdapter.ts';
import type { AppConfig, PostfixOptions } from './config.ts';

class STDIO {
    private postfixConfig: Partial<PostfixOptions>;
    private db: DbAdapter;
    private confPath: string;
    private dbUri: string;

    constructor(config: Partial<AppConfig>, db: DbAdapter = null) {
        this.postfixConfig = config.postfix;
        this.confPath = config.STDIO.postfixConfPath || path.join('etc', 'postfix');
        this.dbUri = config.db.uri;
        this.db = db;
    }

    async writeConf() {
        const writeOps = [
            this.writeMainConf(),
            this.writeVirtualDomains(),
            this.writeVirtualAlias(),
        ];
        await Promise.all(writeOps);
    }

    private async writeMainConf() {
        const main = new BetterWriteStream(path.join(this.confPath, 'main.cf'), { flags: 'w' });
        await this.writeCoreSettings(main);
        await this.writeTLSSettings(main);
        await this.writeVirtual(main);
        await this.writeHardening(main);
        await this.writeMisc(main);
        await this.writeDKIM(main);
        await main.end();
    }

    private async writeCoreSettings(stream: BetterWriteStream) {
        await stream.write(`myhostname = ${this.postfixConfig.hostname}\n`);
        await stream.write(`myorigin = /etc/mailname\n`);
        await stream.write(`mydestination = localhost\n`);
        await stream.write(`relayhost =\n`);
        await stream.write(`inet_interfaces = all\n`);
        await stream.write(`inet_protocols = all\n`);
        await stream.write(`smtpd_banner = $myhostname ESMTP\n`);
    }

    private async writeTLSSettings(stream: BetterWriteStream) {
        await stream.write(`smtpd_tls_cert_file = /etc/postfix/tls/fullchain.pem\n`);
        await stream.write(`smtpd_tls_key_file = /etc/postfix/tls/privkey.pem\n`);
        await stream.write(`smtpd_use_tls = yes\n`);
        await stream.write(`smtpd_tls_security_level = may\n`);
        await stream.write(`smtpd_tls_auth_only = yes\n`);
        await stream.write(`smtp_tls_security_level = encrypt\n`);
        await stream.write(`smtp_tls_loglevel = 1\n`);
        await stream.write(`smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt\n`);
        await stream.write(`smtpd_tls_received_header = yes\n`);
    }

    private async writeVirtual(stream: BetterWriteStream) {
        const protocol = this.dbUri.split(':')[0];
        await stream.write(`virtual_alias_domains = mysql:/etc/postfix/mysql_virtual_domains.cf\n`);
        await stream.write(`virtual_alias_maps = mysql:/etc/postfix/mysql_virtual_alias_maps.cf\n`);
    }

    private async writeHardening(stream: BetterWriteStream) {
        await stream.write(`disable_vrfy_command = yes\n`);
        await stream.write(`smtpd_helo_required = yes\n`);
        await stream.write(`smtpd_helo_restrictions =\n`);
        await stream.write(`    permit_mynetworks,\n`);
        await stream.write(`    reject_invalid_helo_hostname,\n`);
        await stream.write(`    reject_non_fqdn_helo_hostname\n`);
        await stream.write(`smtpd_recipient_restrictions =\n`);
        await stream.write(`    permit_mynetworks,\n`);
        await stream.write(`    permit_sasl_authenticated,\n`);
        await stream.write(`    reject_unauth_destination\n`);
    }

    private async writeMisc(stream: BetterWriteStream) {
        await stream.write(`append_dot_mydomain = no\n`);
        await stream.write(`biff = no\n`);
        await stream.write(`readme_directory = no\n`);
        await stream.write(`compatibility_level = 3.6\n`);
        await stream.write(`maximal_queue_lifetime = 1d\n`);
        await stream.write(`bounce_queue_lifetime = 1d\n`);
        await stream.write(`smtpd_tls_session_cache_database = btree:\${data_directory}/smtpd_scache\n`);
        await stream.write(`smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache\n`);
        await stream.write(`message_size_limit = 30720000\n`);
        await stream.write(`virtual_mailbox_limit = 51200000\n`);
        await stream.write(`virtual_create_maildirsize = yes\n`);
    }

    private async writeDKIM(stream: BetterWriteStream) {
        await stream.write(`milter_default_action = accept\n`);
        await stream.write(`milter_protocol = 2\n`);
        await stream.write(`smtpd_milters = inet:localhost:8891\n`);
        await stream.write(`non_smtpd_milters = $smtpd_milters\n`);
    }

    private async writeVirtualDomains() {
        const virtDomains = new BetterWriteStream(path.join(this.confPath, 'mysql_virtual_domains.cf'), { flags: 'w' });
        await this.writeDbCredentials(virtDomains);
        await virtDomains.write(`query = SELECT name FROM domains WHERE name = '%s'\n`);
        await virtDomains.end();
    }

    private async writeVirtualAlias() {
        const virtDomains = new BetterWriteStream(path.join(this.confPath, 'mysql_virtual_alias_maps.cf'), { flags: 'w' });
        await this.writeDbCredentials(virtDomains);
        await virtDomains.write(`query = SELECT destination FROM relays WHERE alias = '%s'\n`);
        await virtDomains.end();
    }

    private async writeDbCredentials(stream: BetterWriteStream) {
        const dbConfig = parse(this.dbUri);
        await stream.write(`user = ${dbConfig.user}\n`);
        await stream.write(`password = ${dbConfig.password}\n`);
        await stream.write(`hosts = ${dbConfig.host}\n`);
        await stream.write(`dbname = ${dbConfig.database}\n`);
    }
}

export default STDIO;
export { STDIO };
