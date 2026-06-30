import { registrarPlugin } from "./registro";
import { httpsPlugin } from "./https.plugin";
import { headersPlugin } from "./headers.plugin";
import { cookiesPlugin } from "./cookies.plugin";
import { exposicaoPlugin } from "./exposicao.plugin";
import { tecnologiasPlugin } from "./tecnologias.plugin";
import { performancePlugin } from "./performance.plugin";
import { corsPlugin } from "./cors.plugin";
import { dnsPlugin } from "./dns.plugin";

let registrado = false;

/** Registra os plugins embutidos uma única vez. */
export function registrarPluginsEmbutidos(): void {
  if (registrado) return;
  [
    httpsPlugin,
    headersPlugin,
    cookiesPlugin,
    exposicaoPlugin,
    tecnologiasPlugin,
    performancePlugin,
    corsPlugin,
    dnsPlugin,
  ].forEach(registrarPlugin);
  registrado = true;
}
