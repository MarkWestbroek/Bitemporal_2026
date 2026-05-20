// Package worker hosts de Operaton external-task workers die in Go draaien.
// Service-task worker delegeert naar register-handlers; cel-script worker
// evalueert CEL-expressies tegen de procesvariabele-context.
//
// Status: skeleton. Implementatie in Fase 4.
package worker

// ServiceTaskWorker handelt topic "register-call" af.
type ServiceTaskWorker struct{}

// Run start de long-poll loop tegen Operaton.
func (w *ServiceTaskWorker) Run() error { return nil }
