SELECT *
  FROM wijziging AS w,
       param AS p
 WHERE w.tijdstip <= p.peiltijdstip;
