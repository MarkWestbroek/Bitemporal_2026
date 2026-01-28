-- wijzigingen tot en met peiltijdstip (formeel)
SELECT *
  FROM niet_ongedaan_gemaakte_wijziging, param
 WHERE registratie_tijdstip <= param.peiltijdstip