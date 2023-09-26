export interface Storage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    getMany<T = unknown>(prefix: string): Promise<Map<string, T>>;
    listAll<T = unknown>(prefix: string, onItems: (items: Map<string, T>) => Promise<void>): Promise<void>;
    put<T = unknown>(key: string, value: T): Promise<void>;
    put<T = unknown>(items: Record<string, T>): Promise<void>;
    clear(): Promise<void>;
}

