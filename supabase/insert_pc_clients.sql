DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  SELECT organization_id, user_id INTO v_org_id, v_user_id
  FROM profiles WHERE role = 'admin' LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum admin encontrado';
  END IF;

  DELETE FROM pc_clients WHERE organization_id = v_org_id;

  INSERT INTO pc_clients (organization_id, fornecedor, cnpj, cnpj_digits, notes, status_sac, created_by) VALUES
  (v_org_id, 'Tracbel Agro', '03.258.870/0001-53', '03258870000153', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Jonh Deere Brasil', '89.674.782/0017-15', '89674782001715', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'TerraVerde', '09.282.594/0001-45', '09282594000145', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Retipeças Baurus', '02.746.723/0001-60', '02746723000160', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Verde Cana', '49.686.416/0001-02', '49686416000102', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Terra Verde (filial 1)', '09.282.594/0002-26', '09282594000226', 'Fornece para Agricana e Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Terra Verde (filial 2)', '09.282.594/0022-70', '09282594002270', 'Fornece para Agricana e Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Minas Verde (casa da vaca)', '02.541.934/0001-66', '02541934000166', 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Coopercitrus', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Parceagro', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Forte & Fertil', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Agrogalaxy', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'PneusTok', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Pneustore', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Campneus', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Coplacana', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'CAMDA', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Cimoagro', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Nikkeypar', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Construmarques', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa dos Abrasivos', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Bayer S.A', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Termolar', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Serv Agro', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Epis Online Comercio', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'LR COMERCIO', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Protektus', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'DALSON EQUIPAMENTOS', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'FERRAGENS SÃO CARLOS', NULL, NULL, 'Fornece para Agricana e Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'LOJA DO CAFEICULTOR', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Irimag', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Canal Agrícola', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa da Borracha Marília', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Comercial Jauense', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'ALAGRO TECN AGRICOLA', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'DSR', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa da Borracha Bauru', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa da Borracha Botucatu', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'COMERCIAL DEVIDES', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'DALSON EQUIPAMENTOS DE PROTEÇÃO', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'TEKNOLUVAS', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'RCD CONEXOES', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Hidrara', NULL, NULL, 'Fornece para Agricana e Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'APOIOTEC', NULL, NULL, 'Fornece para Agricana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Clube da Borracha', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Dpaschoal', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'HC Pneus', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Distribuidora Pneutop', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Zagar', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Grupo Ferragista', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Auto Pecas Romolar', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa do Oleo Ribeirão Preto', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Bandeirantes Bauru', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Onofre Barbosa', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Casa do Oleo', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'NetPosto', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'All Shine', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Piatã', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Petroposhe', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Sil Soluções em Lubr', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Geomaq', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'Racine Tratores', NULL, NULL, 'Fornece para Tecnocana', 'PRE_CADASTRO', v_user_id),
  (v_org_id, 'TESTE COMLINK', NULL, NULL, 'Fornece para Comlink', 'PRE_CADASTRO', v_user_id);
END $$;
