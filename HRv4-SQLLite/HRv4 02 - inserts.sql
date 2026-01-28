--t0
-- basis record
insert into x (x_id, waarde_van_x) values (1, 'een');



--t1
--Registratie van O: o_id=1 met x_id=1 en waarde=A
insert into registratie (registratie_id, registratie_type, tijdstip, opmerking) values (1, 'Registratie', 't1', '--Registratie van O: o_id=1 met x_id=1 en waarde=A');

--insert de waarde in o
insert into o (o_id, x_id, waarde) values (1, 1, 'A');




--de opvoer van o met o_id=1
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Opvoer', 1, 'o', 1, 't1');



--t2
--Registratie van O: van o_id=1 naar o_id=2 met x_id=1 en waarde=B
insert into registratie (registratie_id, registratie_type, tijdstip, opmerking) values (2, 'Registratie', 't2', '--Registratie van O: van o_id=1 naar o_id=2 met x_id=1 en waarde=B');

--insert de waarde in o
insert into o (o_id, x_id, waarde) values (2, 1, 'B');

--de afvoer van o met o_id=1
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Afvoer', 2, 'o', 1, 't2');

--de opvoer van o met o_id=2
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Opvoer', 2, 'o', 2, 't2');



--t3
--Ongedaanmaking van registratie met registratie_id=2
insert into registratie (registratie_id, registratie_type, tijdstip, maakt_ongedaan_registratie_id, opmerking) values (3, 'Ongedaanmaking', 't3', 2, '--Ongedaanmaking van registratie met registratie_id=2');

--geen waarde in o en geen wijziging!




--t4
--Registratie van O: van o_id=1 naar o_id=3 met x_id=1 en waarde=C
insert into registratie (registratie_id, registratie_type, tijdstip, opmerking) values (4, 'Registratie', 't4', '--Registratie van O: van o_id=1 naar o_id=3 met x_id=1 en waarde=C');

--insert de waarde in o
insert into o (o_id, x_id, waarde) values (3, 1, 'C');

--de afvoer van o met o_id=1
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Afvoer', 4, 'o', 1, 't4');

--de opvoer van o met o_id=3
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Opvoer', 4, 'o', 3, 't4');


--t5
--Correctie van registratie_id=4 van O: van o_id=3 naar o_id=4 met x_id=1 en waarde=Zee
insert into registratie (registratie_id, registratie_type, tijdstip, corrigeert_registratie_id, opmerking) values (5, 'Correctie', 't5', 4, '--Correctie van registratie_id=4 van O: van o_id=3 naar o_id=4 met x_id=1 en waarde=Zee');

--insert de waarde in o
insert into o (o_id, x_id, waarde) values (4, 1, 'Zee');

--de afvoer van o met o_id=3
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Afvoer', 5, 'o', 3, 't5');

--de opvoer van o met o_id=4
insert into wijziging (wijziging_type, registratie_id, representatienaam, representatie_id, tijdstip ) values ('Opvoer', 5, 'o', 4, 't5');
