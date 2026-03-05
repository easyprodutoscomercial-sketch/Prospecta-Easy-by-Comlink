import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { NextRequest, NextResponse } from 'next/server';

const COTACOES_DATA = [
  // Cotação #26 Agricana
  { cotacao_numero: '26', cotacao_nome: 'Agricana', fornecedor: 'Tracbel Agro', cnpj: '03.258.870/0001-53', informe: 'Foi realizado contato para informar sobre a cotação recebida. Porém, Aldieres (que me atendeu) informou que, na região onde está localizada a Agricana, o atendimento é de responsabilidade da TERRAVERDE (CNPJ 09.282.594/0006-50).', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '26', cotacao_nome: 'Agricana', fornecedor: 'Jonh Deere Brasil', cnpj: '89.674.782/0017-15', informe: 'Foi realizado contato pelo número encontrado no Google e na Receita para informar sobre a cotação. Camila, que me atendeu, informou que não possui os contatos das demais unidades e que os disponíveis são apenas os vinculados ao CNPJ 01.329.776/0001-12.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '26', cotacao_nome: 'Agricana', fornecedor: 'TerraVerde', cnpj: '09.282.594/0001-45', informe: 'Foi realizado contato para informar sobre a cotação recebida. Porém, Marcos que é responsavel por responder cotações na Comlink, informou que somente o supervisor (que não estava na empresa) poderia dar uma resposta sobre o Easy. Foi enviado um e-mail novamente para Marcos informando sobre o Easy e da cotação que se encerra hoje 21/01/2026.', resposta: 'NAO_RESPONDEU' },
  // Cotação #27 Agricana
  { cotacao_numero: '27', cotacao_nome: 'Agricana', fornecedor: 'Retipeças Baurus', cnpj: '02.746.723/0001-60', informe: 'Foi realizado contato para informar sobre a cotação. O responsável finalizou o cadastro e respondeu à cotação como \'recusa\', pois informou que não trabalha com esse tipo de solicitação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '27', cotacao_nome: 'Agricana', fornecedor: 'Verde Cana', cnpj: '49.686.416/0001-02', informe: 'Foi realizado contato para informar sobre a cotação, O responsavel Paulo finalizou o cadastro e respondeu a contação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '27', cotacao_nome: 'Agricana', fornecedor: 'Terra Verde', cnpj: '09.282.594/0002-26', informe: 'Foi realizado contato telefônico com Madalena, que informou que o responsável é o Diego e orientou a enviar um e‑mail.', resposta: 'RESPONDEU' },
  { cotacao_numero: '27', cotacao_nome: 'Agricana', fornecedor: 'Terra Verde', cnpj: '09.282.594/0022-70', informe: 'Feito contato via e-mail.', resposta: 'RESPONDEU' },
  // Cotação #28 Agricana
  { cotacao_numero: '28', cotacao_nome: 'Agricana', fornecedor: 'Minas Verde (casa da vaca)', cnpj: '02.541.934/0001-66', informe: 'Feito contato por telefone mas não obtive retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '28', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por telefone mas não obtive retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '28', cotacao_nome: 'Agricana', fornecedor: 'Parceagro', cnpj: null, informe: 'Feito contato por telefone mas não obtive retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '28', cotacao_nome: 'Agricana', fornecedor: 'Forte & Fertil', cnpj: null, informe: 'Feito contato por telefone mas não obtive retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '28', cotacao_nome: 'Agricana', fornecedor: 'Agrogalaxy', cnpj: null, informe: 'Feito contato por telefone mas não obtive retorno.', resposta: 'NAO_RESPONDEU' },
  // Cotação #23 Agricana
  { cotacao_numero: '23', cotacao_nome: 'Agricana', fornecedor: 'PneusTok', cnpj: null, informe: 'Não respondeu', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '23', cotacao_nome: 'Agricana', fornecedor: 'Pneustore', cnpj: null, informe: 'Não respondeu', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '23', cotacao_nome: 'Agricana', fornecedor: 'Campneus', cnpj: null, informe: 'Não respondeu', resposta: 'NAO_RESPONDEU' },
  // Cotação #29 Agricana
  { cotacao_numero: '29', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Foi feito contato por whatsapp com o João, cotações respondidas.', resposta: 'RESPONDEU' },
  { cotacao_numero: '29', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '29', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Informou que não trabalha com o produto e vai recusar.', resposta: 'RESPONDEU' },
  { cotacao_numero: '29', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato via Whatsapp, o fornecedor Carlos não conseguiu o acesso devido estar somente com o celular, pois justificou que trabalha mais no campo.', resposta: 'NAO_RESPONDEU' },
  // Cotação #30 Agricana
  { cotacao_numero: '30', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Foi realizado contato por telefone; Cleusa informou que Jaqueline é a responsável. Mensagem encaminhada via WhatsApp. Cadastro finalizado e cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '30', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Cotação respondia.', resposta: 'RESPONDEU' },
  { cotacao_numero: '30', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Foi feito contato por whatsapp com o João, cotações respondidas.', resposta: 'RESPONDEU' },
  { cotacao_numero: '30', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato via Whatsapp, o fornecedor Carlos não conseguiu o acesso devido estar somente com o celular, pois justificou que trabalha mais no campo.', resposta: 'NAO_RESPONDEU' },
  // Cotação #33 Agricana
  { cotacao_numero: '33', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato com a Jaqueline, assim que possivel ela irá responder as cotações.', resposta: 'RESPONDEU' },
  { cotacao_numero: '33', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato com Carlos via whatsapp para informar sobre cotações disponiveis. Cotação respondida', resposta: 'RESPONDEU' },
  { cotacao_numero: '33', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato com por Whatsapp com João, mas o mesmo esta de férias, então foi feito contato com outro forncecedor responsavel o Leonardo, aguardando o retorno. (cotação encerrada pelo comprador)', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '33', cotacao_nome: 'Agricana', fornecedor: 'Camda', cnpj: null, informe: 'Feito contato via e-mail, Whatsapp e telefone para informar sobre cotação no portal. Sem retorno. (cotação encerrado pelo comprador).', resposta: 'RESPONDEU' },
  // Cotação #31 Agricana
  { cotacao_numero: '31', cotacao_nome: 'Agricana', fornecedor: 'Nikkeypar', cnpj: null, informe: 'Feito contato via Whatsapp, o forncedor precisa homologar na empresa para que consigam dar sequencia na cotação.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '31', cotacao_nome: 'Agricana', fornecedor: 'Construmarques', cnpj: null, informe: 'Feito contato via Whatsapp, o fornecedor Annderson pediu que fosse enviado um e-mail. E-mail enviado, aguardando retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '31', cotacao_nome: 'Agricana', fornecedor: 'Casa dos Abrasivos', cnpj: null, informe: 'Feito contato por tefone com o Matheus ele informou que o forncedor responsavel por respopnder cotações é o Sebastião e passou o Whatsapp dele. Aguardando retorno.', resposta: 'NAO_RESPONDEU' },
  // Cotação #32 Agricana
  { cotacao_numero: '32', cotacao_nome: 'Agricana', fornecedor: 'Bayer S.A', cnpj: null, informe: 'Sem contato', resposta: 'NAO_RESPONDEU' },
  // Cotação #34 Comlink
  { cotacao_numero: '34', cotacao_nome: 'Comlink', fornecedor: 'TESTE COMLINK', cnpj: null, informe: 'Teste interno Comlink', resposta: 'NAO_RESPONDEU' },
  // Cotação #35 Comlink
  { cotacao_numero: '35', cotacao_nome: 'Comlink', fornecedor: 'TESTE COMLINK', cnpj: null, informe: 'Teste interno Comlink', resposta: 'NAO_RESPONDEU' },
  // Cotação #36 Agricana
  { cotacao_numero: '36', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato com a Jaqueline, assim que possivel ela irá responder as cotações.', resposta: 'RESPONDEU' },
  { cotacao_numero: '36', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato com Carlos via whatsapp para informar sobre cotações disponiveis. Cotação respondida', resposta: 'RESPONDEU' },
  { cotacao_numero: '36', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato com por Whatsapp com João, mas o mesmo esta de férias, então foi feito contato com outro forncecedor responsavel o Leonardo, aguardando o retorno. (cotação encerrada pelo comprador)', resposta: 'RESPONDEU' },
  { cotacao_numero: '36', cotacao_nome: 'Agricana', fornecedor: 'Camda', cnpj: null, informe: 'Feito contato via e-mail, Whatsapp e telefone para informar sobre cotação no portal. Sem retorno. (cotação encerrado pelo comprador).', resposta: 'RESPONDEU' },
  // Cotação #37 Agricana
  { cotacao_numero: '37', cotacao_nome: 'Agricana', fornecedor: 'Termolar', cnpj: null, informe: 'Tentativa de contato por telefone sem retorno. Enviado um e-mail para o mesmo.', resposta: 'NAO_RESPONDEU' },
  // Cotação #38 Agricana
  { cotacao_numero: '38', cotacao_nome: 'Agricana', fornecedor: 'Termolar', cnpj: null, informe: 'Tentativa de contato por telefone sem retorno. Enviado um e-mail para o mesmo.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '38', cotacao_nome: 'Agricana', fornecedor: 'Serv Agro', cnpj: null, informe: 'Feito contato com o Claudio, o mesmo informou para encaminhar mensagem para o whatsapp do Paulo.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '38', cotacao_nome: 'Agricana', fornecedor: 'Epis Online Ccomercio', cnpj: null, informe: 'Feito contato por telefone, foi passado um numero de whatsapp. Sem retorno ate o momento.', resposta: 'NAO_RESPONDEU' },
  // Cotação #39 Agricana
  { cotacao_numero: '39', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Recusada', resposta: 'RESPONDEU' },
  { cotacao_numero: '39', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Recusada', resposta: 'RESPONDEU' },
  { cotacao_numero: '39', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Recusada', resposta: 'RESPONDEU' },
  // Cotação #40 Agricana
  { cotacao_numero: '40', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Respondida pelo fornecedor Carlos.', resposta: 'RESPONDEU' },
  { cotacao_numero: '40', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato com a forncedora Jaqueline, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '40', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Respondida', resposta: 'RESPONDEU' },
  { cotacao_numero: '40', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Respondida', resposta: 'RESPONDEU' },
  // Cotação #41 Agricana
  { cotacao_numero: '41', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: '', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '41', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: '', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '41', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Recusado', resposta: 'RESPONDEU' },
  { cotacao_numero: '41', cotacao_nome: 'Agricana', fornecedor: 'Camda', cnpj: null, informe: 'Confirmado', resposta: 'RESPONDEU' },
  // Cotação #42 Agricana
  { cotacao_numero: '42', cotacao_nome: 'Agricana', fornecedor: 'LR COMERCIO', cnpj: null, informe: 'Feito contato com a Andressa po telefone e Whatsapp. Cotações respondidas.', resposta: 'RESPONDEU' },
  { cotacao_numero: '42', cotacao_nome: 'Agricana', fornecedor: 'Epis Online Ccomercio', cnpj: null, informe: 'Feito conbtato por whatsapp com Thais. Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '42', cotacao_nome: 'Agricana', fornecedor: 'Protektus', cnpj: null, informe: 'Feito contato com o fornecedor Sandro. Ocorreu um erro na cotação, mas foi resolvido no dia seguinte. Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '42', cotacao_nome: 'Agricana', fornecedor: 'DALSON EQUIPAMENTOS', cnpj: null, informe: 'Feito contato por telefone com Rafael, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '42', cotacao_nome: 'Agricana', fornecedor: 'FERRAGENS SÃO CARLOS', cnpj: null, informe: 'Feito contato com Pedro por whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #43 Agricana
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'LOJA DO CAFEICULTOR', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Irimag', cnpj: null, informe: 'Feito contato por whatsapp e telefone, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Canal Agrícola', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Casa da Borracha Marília', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Comercial Jauense', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'ALAGRO TECN AGRICOLA', cnpj: null, informe: 'Feito contato por whatsapp e telefone, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'DSR', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Casa da Borracha Bauru', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Casa da Borracha Botucatu', cnpj: null, informe: 'Feito contato via e-mail e whatsapp, Claudia respondeu mas a cotação foi encerrada pelo comprador.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'COMERCIAL DEVIDES', cnpj: null, informe: 'Feito contato via e-mail e ligação. Sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '43', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp e telefone, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #44 Agricana
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'DALSON EQUIPAMENTOS DE PROTEÇÃO', cnpj: null, informe: 'Feito contato por telefone com Rafael, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'Ferragens São Carlos', cnpj: null, informe: 'Feito contato por whatsapp com Pedro, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'epis online comercio', cnpj: null, informe: 'Feito contato com Thais por whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'Protektus', cnpj: null, informe: 'Feito contato com sandro por whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'LR COMERCIO', cnpj: null, informe: 'Feito contato com Andressa por whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '44', cotacao_nome: 'Agricana', fornecedor: 'TEKNOLUVAS', cnpj: null, informe: 'Feito contato com Andressa por whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #45 Agricana
  { cotacao_numero: '45', cotacao_nome: 'Agricana', fornecedor: 'RCD CONEXOES', cnpj: null, informe: 'Feito contato duas vezes por whatsapp, o mesmo informou que não tem interesse.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '45', cotacao_nome: 'Agricana', fornecedor: 'Irimag', cnpj: null, informe: 'Feito contato com a fornecedora Aline por telefone e whatsapp 3 vezes, a mesma informou que iria responder. Não respondeu.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '45', cotacao_nome: 'Agricana', fornecedor: 'Hidrara', cnpj: null, informe: 'Feito contato por e-mail e telefone com o fornecedro Luan, o mesmo respondeu as cotaçoes.', resposta: 'RESPONDEU' },
  { cotacao_numero: '45', cotacao_nome: 'Agricana', fornecedor: 'APOIOTEC', cnpj: null, informe: 'Feito contato com Danielle por telefone e whatsapp, a mesma respondeu as cotaçoes.', resposta: 'RESPONDEU' },
  // Cotação #46 Agricana
  { cotacao_numero: '46', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Cotação respondida pelo fornecedor Rodolfo.', resposta: 'RESPONDEU' },
  { cotacao_numero: '46', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Cotação respondida pela fornecedora Jaqueline.', resposta: 'RESPONDEU' },
  { cotacao_numero: '46', cotacao_nome: 'Agricana', fornecedor: 'coplacana', cnpj: null, informe: 'Feito contato com João e Leonardo, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '46', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Cotação respondida pelo fornecedor Carlos.', resposta: 'RESPONDEU' },
  // Cotação #47 Agricana
  { cotacao_numero: '47', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Feito contato por telefone e whatsapp para o fornecedor Rodolfo, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '47', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato por ligação e whatsapp para fornecedora Jaqueline, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '47', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor Carlos, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '47', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor João, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #48 Agricana
  { cotacao_numero: '48', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Feito contato por telefone e whatsapp para o fornecedor Rodolfo, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '48', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato por ligação e whatsapp para fornecedora Jaqueline, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '48', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor Carlos, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '48', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor João, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #49 Agricana
  { cotacao_numero: '49', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Feito contato por telefone e whatsapp para o fornecedor Rodolfo, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '49', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato por ligação e whatsapp para fornecedora Jaqueline.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '49', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor Carlos, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '49', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor João, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #50 Agricana
  { cotacao_numero: '50', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Feito contato por telefone e whatsapp para o fornecedor Rodolfo, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '50', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato por ligação e whatsapp para fornecedora Jaqueline.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '50', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor Carlos, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '50', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor João, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #51 Agricana
  { cotacao_numero: '51', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Feito contato por telefone e whatsapp para o fornecedor Rodolfo, cotação não respondida.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '51', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato por ligação e whatsapp para fornecedora Jaqueline.', resposta: 'RESPONDEU' },
  { cotacao_numero: '51', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor Carlos, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '51', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato por whatsapp com o fornecedor João, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #52 Tecnocana
  { cotacao_numero: '52', cotacao_nome: 'Tecnocana', fornecedor: 'Clube da Borracha', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '52', cotacao_nome: 'Tecnocana', fornecedor: 'Dpaschoal', cnpj: null, informe: 'Feito contato via whatsapp e e-mail e ligação. Em contato com Elisa.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '52', cotacao_nome: 'Tecnocana', fornecedor: 'HC Pneus', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '52', cotacao_nome: 'Tecnocana', fornecedor: 'Distribuidora Pneutop', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  // Cotação #53 Tecnocana
  { cotacao_numero: '53', cotacao_nome: 'Tecnocana', fornecedor: 'Zagar', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, cotação respondida pelo fornecedor Valmir.', resposta: 'RESPONDEU' },
  // Cotação #54 Agricana
  { cotacao_numero: '54', cotacao_nome: 'Agricana', fornecedor: 'CAMDA', cnpj: null, informe: 'Informado via whatsapp e tentativa de ligação.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '54', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Foi informada via whatasapp para Jaqueline.', resposta: 'RESPONDEU' },
  { cotacao_numero: '54', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Cotação respondida por João.', resposta: 'RESPONDEU' },
  { cotacao_numero: '54', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Cotação respondida por Carlos.', resposta: 'RESPONDEU' },
  // Cotação #55 Tecnocana
  { cotacao_numero: '55', cotacao_nome: 'Tecnocana', fornecedor: 'Ferragens São Carlos', cnpj: null, informe: 'Informado via whatsapp e tentativa de ligação.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '55', cotacao_nome: 'Tecnocana', fornecedor: 'Grupo Ferragista', cnpj: null, informe: 'Feito contato via Whatspp', resposta: 'RESPONDEU' },
  { cotacao_numero: '55', cotacao_nome: 'Tecnocana', fornecedor: 'Zagar', cnpj: null, informe: 'Informado via whatsapp e tentativa de ligação.', resposta: 'NAO_RESPONDEU' },
  // Cotação #56 Tecnocana
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Auto Pecas Romolar', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Casa do Oleo Ribeirao Preto', cnpj: null, informe: 'Feito contato via whatsapp e foi informado o contato de Aguinaldo, aguardando resposta do mesmo.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Grupo Ferragista', cnpj: null, informe: 'Feito contato por whatsapp com Tiago, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Zagar', cnpj: null, informe: 'Feito contato por whatsapp com Valmir, contação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Bandeirantes Bauru', cnpj: null, informe: 'Feito contato com Guilherme, o mesmo informou que esta aguardando chegar o item em estoque para responder a cotação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Onofre Barbosa', cnpj: null, informe: 'Feito contato por e-mail e whatsapp com Carlos, cotão respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Hidrara', cnpj: null, informe: 'Feito contato por telefone com Luan, o mesmo informou para enviar e-mail para o Renan que responde a Tecnocana. Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '56', cotacao_nome: 'Tecnocana', fornecedor: 'Casa do Oleo', cnpj: null, informe: 'Feito contato com o fornecedor Kleber, cotação respondida.', resposta: 'RESPONDEU' },
  // Cotação #57 Tecnocana
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'NetPosto', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'All Shine', cnpj: null, informe: 'Feito contato via whatsapp e e-mail, aguardando respostas.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'Grupo Ferragista', cnpj: null, informe: 'Feito contato via whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'Ferregens São Carlos', cnpj: null, informe: 'Feito contato via whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'Piatã', cnpj: null, informe: 'Feito contato via whatsapp, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '57', cotacao_nome: 'Tecnocana', fornecedor: 'Petroposhe', cnpj: null, informe: 'Feito contato via whatsap, o fornecedor acessou o link e esta respondendo a cotação.', resposta: 'RESPONDEU' },
  // Cotação #58 Tecnocana
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Sil Soluções em Lubr', cnpj: null, informe: 'Feito contato com Marco, o mesmo informou que só vai ter acesso durante a noite.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Terra Verde', cnpj: null, informe: 'Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Geomaq', cnpj: null, informe: 'Feito contato com Cleber, cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Casa do Oleo ribeirão Preto', cnpj: null, informe: 'Tntativa de contato com Adauto, sem retorno.', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Casa do Oleo', cnpj: null, informe: 'Feito contato com Kleber, o mesmo respondeu a cotação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Racine Tratores', cnpj: null, informe: 'Cotação respondida.', resposta: 'RESPONDEU' },
  { cotacao_numero: '58', cotacao_nome: 'Tecnocana', fornecedor: 'Hidrara', cnpj: null, informe: 'Feito contato com Renan, o mesmo informou que vai precisar codificar todos seus itens novamente, pois no portal só tem a referencia sem os codigos. Após finalizar ira responder.', resposta: 'NAO_RESPONDEU' },
  // Cotação #59 Agricana
  { cotacao_numero: '59', cotacao_nome: 'Agricana', fornecedor: 'Cimoagro', cnpj: null, informe: 'Feito contato com a fornecedora Jaqueline, a mesma deu o retorno para responder a cotação,', resposta: 'NAO_RESPONDEU' },
  { cotacao_numero: '59', cotacao_nome: 'Agricana', fornecedor: 'Coopercitrus', cnpj: null, informe: 'Feito contato com Carlos com aviso de cotação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '59', cotacao_nome: 'Agricana', fornecedor: 'Coplacana', cnpj: null, informe: 'Feito contato com João com aviso de cotação.', resposta: 'RESPONDEU' },
  { cotacao_numero: '59', cotacao_nome: 'Agricana', fornecedor: 'Camda', cnpj: null, informe: 'Feito contato com Rodolfo com aviso de cotação.', resposta: 'RESPONDEU' },
];

const PEDIDOS_ATIVOS = [
  { pedido_numero: '13', empresa: 'Irimag', situacao: 'PENDENTE', informe: 'Informado do pedido', finalizado: false },
  { pedido_numero: '22', empresa: 'Coopercitrus', situacao: 'PENDENTE', informe: 'Informado do pedido', finalizado: false },
  { pedido_numero: '24', empresa: 'Coplacana', situacao: 'PENDENTE', informe: 'Informado do pedido', finalizado: false },
];

const PEDIDOS_FINALIZADOS = [
  { pedido_numero: '3', empresa: 'Coopercitrus', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '4', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '5', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '7', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '8', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '9', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '10', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '11', empresa: 'Dalson Equipamentos de Protecao', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '12', empresa: 'Alagro Tecn Agricola', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '14', empresa: 'Ferragens Sao Carlos', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '15', empresa: 'Cimoagro', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '16', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '17', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '18', empresa: 'Coplacana', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '19', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '20', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '21', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '23', empresa: 'Zagar', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '25', empresa: 'Grupo Ferragista', situacao: 'ACEITO', informe: 'Informado do pedido' },
  { pedido_numero: '26', empresa: 'Camda', situacao: 'ACEITO', informe: 'Informado do pedido' },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const orgId = profile.organization_id;
    const userId = user.id;

    // Check if tables exist
    const { error: tableCheck } = await admin.from('pc_cotacoes').select('id').limit(1);
    if (tableCheck) {
      return NextResponse.json({
        error: 'Tabelas nao existem. Execute o SQL de migration no Supabase Dashboard > SQL Editor.',
        sql_file: 'supabase/migrations/20250304_pedidos_cotacoes.sql',
      }, { status: 400 });
    }

    // Clear existing data for this org
    await admin.from('pc_pedidos').delete().eq('organization_id', orgId);
    await admin.from('pc_cotacoes').delete().eq('organization_id', orgId);
    await admin.from('pc_clients').delete().eq('organization_id', orgId);

    // Insert cotacoes
    const cotacoesInsert = COTACOES_DATA.map((c) => ({
      organization_id: orgId,
      cotacao_numero: c.cotacao_numero,
      cotacao_nome: c.cotacao_nome,
      fornecedor: c.fornecedor,
      cnpj: c.cnpj,
      informe: c.informe,
      resposta: c.resposta,
      created_by: userId,
    }));

    // Insert in batches of 50
    let cotacoesCreated = 0;
    for (let i = 0; i < cotacoesInsert.length; i += 50) {
      const batch = cotacoesInsert.slice(i, i + 50);
      const { error } = await admin.from('pc_cotacoes').insert(batch);
      if (error) {
        console.error('Error inserting cotacoes batch:', error);
        return NextResponse.json({ error: `Erro ao inserir cotacoes: ${error.message}` }, { status: 500 });
      }
      cotacoesCreated += batch.length;
    }

    // Insert pedidos ativos
    const pedidosAtivosInsert = PEDIDOS_ATIVOS.map((p) => ({
      organization_id: orgId,
      pedido_numero: p.pedido_numero,
      empresa: p.empresa,
      situacao: p.situacao,
      informe: p.informe,
      finalizado: false,
      created_by: userId,
    }));

    const { error: e2 } = await admin.from('pc_pedidos').insert(pedidosAtivosInsert);
    if (e2) {
      return NextResponse.json({ error: `Erro ao inserir pedidos ativos: ${e2.message}` }, { status: 500 });
    }

    // Insert pedidos finalizados
    const pedidosFinInsert = PEDIDOS_FINALIZADOS.map((p) => ({
      organization_id: orgId,
      pedido_numero: p.pedido_numero,
      empresa: p.empresa,
      situacao: p.situacao,
      informe: p.informe,
      finalizado: true,
      finalizado_at: new Date().toISOString(),
      created_by: userId,
    }));

    const { error: e3 } = await admin.from('pc_pedidos').insert(pedidosFinInsert);
    if (e3) {
      return NextResponse.json({ error: `Erro ao inserir pedidos finalizados: ${e3.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cotacoes_created: cotacoesCreated,
      pedidos_ativos_created: PEDIDOS_ATIVOS.length,
      pedidos_finalizados_created: PEDIDOS_FINALIZADOS.length,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
