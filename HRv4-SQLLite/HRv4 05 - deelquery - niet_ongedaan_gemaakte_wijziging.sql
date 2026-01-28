SELECT wijziging_id,
       registratie_id,
       wijziging_type,
       representatienaam,
       representatie_id,
       registratie_tijdstip,
       registratie_type,
       correctie_corrigeert_registratie_id,-- kan alleen gevuld zijn indien registratie_type = Correctie
       registratie_opmerking,
       ongedaan_gemaakt,
       registratie_ongedaan_gemaakt_door_registratie_id
  FROM wijziging_plus_registratie_plus_ongedaanmaking AS w
 WHERE NOT ongedaan_gemaakt;
