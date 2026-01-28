SELECT w.wijziging_id AS wijziging_id,
       w.registratie_id AS registratie_id,
       w.wijziging_type AS wijziging_type,
       w.representatienaam AS representatienaam,
       w.representatie_id AS representatie_id,
       reg.tijdstip AS registratie_tijdstip,
       reg.registratie_type AS registratie_type,
       reg.corrigeert_registratie_id AS correctie_corrigeert_registratie_id,-- kan alleen gevuld zijn indien registratie_type = Correctie
       om.registratie_id IS NOT NULL AS ongedaan_gemaakt,
       om.registratie_id AS registratie_ongedaan_gemaakt_door_registratie_id,-- de Ongedaanmaking die deze registratie ongedaan heeft gemaakt; alleen gevuld indien ongedaan gemaakt
       om.tijdstip AS registratie_ongedaan_gemaakt_op_tijdstip,-- het tijdstip waarop deze registratie ongedaan is gemaakt; alleen gevuld indien ongedaan gemaakt
       /* opmerkingen */reg.opmerking AS registratie_opmerking,
       om.opmerking AS ongedaanmaking_opmerking,
       p.peiltijdstip AS peiltijdstip-- NULL AS n_________________________n,
  /* * */FROM wijziging AS w,
       param AS p
       JOIN
       (-- registraties plus eventuele ongedaanmaking
           registratie AS reg,
           param AS pom
           LEFT JOIN
           registratie AS om ON (om.maakt_ongedaan_registratie_id = reg.registratie_id/* hang een eventuele ongedaanmaking eraan TODO: meer dan 1 om... */ AND 
                                 om.tijdstip <= pom.peiltijdstip) 
       ),
       param AS preg ON (w.registratie_id = reg.registratie_id/* hang de registratie met om aan de wijziging */ AND 
                         reg.tijdstip <= preg.peiltijdstip);

;

;
