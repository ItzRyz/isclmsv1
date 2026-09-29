-- P1-704: unique skala per organisasi (untuk upsert kode).
alter table grade_scales
  add constraint grade_scales_org_code_unique unique (organization_id, code);
