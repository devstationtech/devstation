/**
 * Removes a service's projection from the VMs that hosted it, after teardown.
 * One command instance carries all hosts from a single `ServiceUninstalled`
 * event so the handler can persist each affected cluster once. The inverse of
 * `RecordVirtualMachineServices`.
 */
export class ForgetVirtualMachineServices {
  constructor(
    readonly serviceId: string,
    readonly hosts: readonly string[],
  ) {}
}
