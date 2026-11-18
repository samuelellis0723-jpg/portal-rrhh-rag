require('../src/config/env');
const { DeepSeekClient } = require('../src/integrations/deepseek');

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log(JSON.stringify({ proveedor: 'deepseek', estado: 'falta_DEEPSEEK_API_KEY', probado: false }));
    process.exitCode = 1;
    return;
  }
  const result = await new DeepSeekClient().completeJson({
    system: 'Prueba de conectividad. Devuelve exclusivamente JSON con la propiedad ok y valor true.',
    user: 'Confirma la conexión con {"ok":true}.', maxTokens: 30,
  });
  if (result.ok !== true) throw new Error('INVALID_RESPONSE');
  console.log(JSON.stringify({ proveedor: 'deepseek', estado: 'respuesta_JSON_verificada', probado: true }));
}
main().catch(() => {
  console.error(JSON.stringify({ proveedor: 'deepseek', estado: 'no_disponible', probado: false }));
  process.exitCode = 1;
});
