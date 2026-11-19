const { ChatService } = require('../services/chat-service');
const repository = require('../repositories/personal-chat-repository');

function createController(service = new ChatService()) {
  return {
    async chat(req, res) {
      const data = await service.ask({ collaboratorId: req.auth.data.colaborador.id, role: req.auth.data.colaborador.rol, message: req.chatMessage });
      res.status(200).json({ data });
    },
    async clear(req, res) {
      const data = await repository.deleteConversation(req.auth.data.colaborador.id);
      res.json({ data });
    },
    async history(req, res) {
      const data = await repository.history(req.auth.data.colaborador.id, req.pagination);
      res.json({ data });
    },
  };
}

module.exports = createController();
module.exports.createController = createController;
