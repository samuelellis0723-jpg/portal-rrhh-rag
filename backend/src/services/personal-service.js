const repository = require('../repositories/personal-chat-repository');
const { todayCR } = require('../agents/data-agent');

function getNextPayment(auth) { return repository.ownNextPayment(auth.data.colaborador.id, todayCR()); }
function getNextEvaluation(auth) { return repository.ownNextEvaluation(auth.data.colaborador.id, todayCR()); }
function getRequests(auth, pagination) { return repository.ownRequests(auth.data.colaborador.id, pagination); }

module.exports = { getNextPayment, getNextEvaluation, getRequests };
