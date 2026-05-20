# Process Engine
I would like to have a process engine that is flexible enough to configure
- BPMN
- DMN
- CMMI
and use these action-definitions in relation to each other.

I know open source tools like Operaton and Valtimo (not sure that is open source) (Camunda spin-off(s) after it went closed source) exist. I could work on top of them if that pays off.

Important is that:
- the complete BPMN definition is implemented, including sub-process and call-activity
- data can be linked to a canonical data model, e.g. the type of metamodels we make in this project
- DMN can use this REPs and their velden / afgeleide velden as input
- DMN output can be defined in terms of the same data types, enums and reflistitems as we use in the canonical model
- processes can use this data definitions in the same manner and also produce data in the same canonical model language via the input and output event definitions and within the process when delegating service tasks to APIs
- script tasks can use one or more script languages and data can be used in the same way we use it in CEL expressions in derived fields, or expressions in our form definitions

The reason that I would like to include CMMI, but not necessairily exactly CMMI is that:
- we often have context tasks, that van be executed at any time
- they may be modeled via ad hoc processes or in other ways, but in fact, I think they just don't obey the process axioma. They are context tasks, that respond to events or data state. Or are user related.
- examples:
  - ask a colleague a question about this case
  - delegate a task to a third party (can be modelled in the process, but some tasks just are always possible)
  - ask for a review
  - attach client feedback to a case (at almost any moment)

Can you analyse the trade-off between working on top of these or bravely starting our own engine?