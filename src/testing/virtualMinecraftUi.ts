interface QueuedFormResponse {
    canceled?: boolean;
    selection?: number;
    formValues?: unknown[];
}

const responseQueue: QueuedFormResponse[] = [];

export const virtualMinecraftUi = {
    queueResponse(response: QueuedFormResponse) {
        responseQueue.push(response);
    },
    clearResponses() {
        responseQueue.length = 0;
    },
    nextResponse(): QueuedFormResponse {
        return responseQueue.shift() ?? { canceled: true };
    },
};

class BaseFormData {
    title(_value: unknown) {
        return this;
    }

    async show(_player: unknown) {
        return virtualMinecraftUi.nextResponse();
    }
}

export class ActionFormData extends BaseFormData {
    body(_value: unknown) {
        return this;
    }

    button(_text: unknown, _iconPath?: string) {
        return this;
    }
}

export class MessageFormData extends BaseFormData {
    body(_value: unknown) {
        return this;
    }

    button1(_value: unknown) {
        return this;
    }

    button2(_value: unknown) {
        return this;
    }
}

export class ModalFormData extends BaseFormData {
    dropdown(_label: unknown, _options: unknown[], _defaultValueIndex?: number) {
        return this;
    }

    slider(_label: unknown, _minimum: number, _maximum: number, _valueStep: number, _defaultValue?: number) {
        return this;
    }

    textField(_label: unknown, _placeholderText: unknown, _defaultValue?: string) {
        return this;
    }

    toggle(_label: unknown, _defaultValue?: boolean) {
        return this;
    }
}

export const FormCancelationReason = {
    UserBusy: "UserBusy",
    UserClosed: "UserClosed",
} as const;
