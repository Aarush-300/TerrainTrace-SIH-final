const { create } = require('xmlbuilder2');

function buildCapXml(alert) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('alert', { xmlns: 'urn:oasis:names:tc:emergency:cap:1.2' })
      .ele('identifier').txt(alert.identifier).up()
      .ele('sender').txt(alert.sender).up()
      .ele('sent').txt(alert.sent.toISOString()).up()
      .ele('status').txt(alert.status).up()
      .ele('msgType').txt(alert.msgType).up()
      .ele('scope').txt(alert.scope).up()
      .ele('info')
        .ele('category').txt('Geo').up()
        .ele('event').txt('Landslide').up()
        .ele('urgency').txt(alert.urgency).up()
        .ele('severity').txt(alert.severity).up()
        .ele('certainty').txt(alert.certainty).up()
        .ele('headline').txt(alert.headline).up()
        .ele('description').txt(alert.description).up()
        .ele('area')
          .ele('areaDesc').txt(alert.areaDesc).up();

  if (alert.circle && alert.circle.lat != null && alert.circle.lng != null && alert.circle.radiusKm != null) {
    doc.ele('circle').txt(`${alert.circle.lat},${alert.circle.lng} ${alert.circle.radiusKm}`).up();
  }
  
  doc.up().up().up();
  return doc.end({ prettyPrint: true });
}

function buildCapFeed(alerts) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('alerts', { xmlns: 'urn:oasis:names:tc:emergency:cap:1.2' });
  
  for (const alert of alerts) {
    const alertNode = doc.ele('alert')
      .ele('identifier').txt(alert.identifier).up()
      .ele('sender').txt(alert.sender).up()
      .ele('sent').txt(alert.sent.toISOString()).up()
      .ele('status').txt(alert.status).up()
      .ele('msgType').txt(alert.msgType).up()
      .ele('scope').txt(alert.scope).up()
      .ele('info')
        .ele('category').txt('Geo').up()
        .ele('event').txt('Landslide').up()
        .ele('urgency').txt(alert.urgency).up()
        .ele('severity').txt(alert.severity).up()
        .ele('certainty').txt(alert.certainty).up()
        .ele('headline').txt(alert.headline).up()
        .ele('description').txt(alert.description).up()
        .ele('area')
          .ele('areaDesc').txt(alert.areaDesc).up();
          
    if (alert.circle && alert.circle.lat != null && alert.circle.lng != null && alert.circle.radiusKm != null) {
      alertNode.ele('circle').txt(`${alert.circle.lat},${alert.circle.lng} ${alert.circle.radiusKm}`).up();
    }
    alertNode.up().up().up();
  }
  
  return doc.end({ prettyPrint: true });
}

module.exports = { buildCapXml, buildCapFeed };
