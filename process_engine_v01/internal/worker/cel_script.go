package worker

// CELScriptWorker handelt topic "cel-eval" af. Hergebruikt de CEL-evaluator
// uit het bitemp register (afgeleide velden) zodat script-tasks dezelfde
// semantiek hebben als afgeleide velden en formulier-expressies.
//
// Status: skeleton. Implementatie in Fase 4.
type CELScriptWorker struct{}

// Run start de long-poll loop tegen Operaton.
func (w *CELScriptWorker) Run() error { return nil }
