import { promises as dnsPromises } from 'node:dns';

try {
  const resolverDefault = new dnsPromises.Resolver();
  const resDefault = await resolverDefault.resolveSrv('_mongodb._tcp.cluster0.ile4s29.mongodb.net');
  console.log('Default Resolver Succeeded:', resDefault.length, 'records');
} catch (e) {
  console.error('Default Resolver Failed:', e.message);
}

try {
  const resolverGoogle = new dnsPromises.Resolver();
  resolverGoogle.setServers(['8.8.8.8', '8.8.4.4']);
  const resGoogle = await resolverGoogle.resolveSrv('_mongodb._tcp.cluster0.ile4s29.mongodb.net');
  console.log('Google Resolver Succeeded:', resGoogle.length, 'records');
} catch (e) {
  console.error('Google Resolver Failed:', e.message);
}
