function createUUID() {
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (
    c
  ) {
    var r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}

function createMessage(event, data) {
  return JSON.stringify({
    event,
    data,
  });
}

function parseMessage(data) {
  try {
    return { event: '', data: null, ...JSON.parse(data) };
  } catch (e) {
    throw new Error('Invalid message');
  }
}

exports.createUUID = createUUID;
exports.createMessage = createMessage;
exports.parseMessage = parseMessage;
