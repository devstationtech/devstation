type Class<T> = new (...args: never[]) => T;
type Factory<T> = (container: Container) => T;

export class Container {
  private readonly factories = new Map<Class<unknown>, Factory<unknown>>();
  private readonly instances = new Map<Class<unknown>, unknown>();

  register<T>(clazz: Class<T>, factory: Factory<T>): Container {
    this.factories.set(clazz as Class<unknown>, factory);
    return this;
  }

  get<T>(clazz: Class<T>): T {
    if (this.instances.has(clazz as Class<unknown>)) {
      return this.instances.get(clazz as Class<unknown>) as T;
    }

    const factory = this.factories.get(clazz as Class<unknown>);
    if (!factory) throw new Error(`dependency not registered: ${clazz.name}`);
    const instance: T = factory(this) as T;

    this.instances.set(clazz as Class<unknown>, instance);
    return instance;
  }

  build(): Container {
    return this;
  }
}
