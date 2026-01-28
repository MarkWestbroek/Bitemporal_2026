SELECT o.o_id AS o_id,
       o.x_id AS x_id,
       o.waarde AS waarde,
       opvoer.registratie_tijdstip AS registratietijdstip_opvoer,
       opvoer.registratie_type AS registratietype_opvoer,-- opvoer.registratie_opmerking as registratieopmerking_opvoer,
       --opvoer.ongedaan_gemaakt AS ongedaan_gemaakt,
       --opvoer.registratie_ongedaan_gemaakt_door_registratie_id AS ongedaan_gemaakt_door_registratie_id,
       --opvoer.registratie_ongedaan_gemaakt_op_tijdstip AS ongedaan_gemaakt_op_tijdstip,
       afvoer.registratie_tijdstip AS registratietijdstip_afvoer,
       afvoer.registratie_type AS registratietype_afvoer,
       afvoer.ongedaan_gemaakt AS hersteld,
       afvoer.registratie_ongedaan_gemaakt_op_tijdstip AS hersteld_op_tijdstip,
       afvoer.registratie_ongedaan_gemaakt_door_registratie_id AS hersteld_door_registratie_id
       -- afvoer.registratie_opmerking as registratieopmerking_afvoer,
  FROM o
       JOIN
       wijziging_plus_registratie_plus_ongedaanmaking AS opvoer ON (opvoer.wijziging_type = 'Opvoer' AND 
                                                                    opvoer.representatienaam = 'o' AND 
                                                                    opvoer.representatie_id = o.o_id) 
       LEFT JOIN
       wijziging_plus_registratie_plus_ongedaanmaking AS afvoer ON (afvoer.wijziging_type = 'Afvoer' AND 
                                                                    afvoer.representatienaam = 'o' AND 
                                                                    afvoer.representatie_id = o.o_id)
                                                                    
WHERE (registratietijdstip_afvoer IS NULL OR 
        hersteld) AND 
       NOT opvoer.ongedaan_gemaakt;
