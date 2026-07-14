export class ServiceInstallInProgress extends Error {
  constructor(serviceId: string) {
    super(
      `service ${serviceId} already has a install in progress — wait for it to finish or cancel its execution first.`,
    );
  }
}
