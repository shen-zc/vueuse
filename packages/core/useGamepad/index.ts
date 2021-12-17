import type { MaybeRef } from '@vueuse/shared'
import { createEventHook, tryOnMounted } from '@vueuse/shared'
import { useEventListener, useRafFn } from '@vueuse/core'
import type { Ref } from 'vue-demi'
import { reactive, computed } from 'vue-demi'
import type { ConfigurableWindow, ConfigurableNavigator } from '../_configurable'
import { defaultNavigator } from '../_configurable'

export interface UseGamepadOptions extends ConfigurableWindow, ConfigurableNavigator {
  /**
   * The interval at which to poll the controller
   *
   * @default 60
   */
  pollInterval?: MaybeRef<number>
}

/**
 * Maps a standard standard gamepad to an Xbox 360 Controller.
 */
export function mapGamepadToXbox360Controller(gamepad: Ref<Gamepad | undefined>) {
  return computed(() => {
    if (gamepad.value) {
      return {
        buttons: {
          a: gamepad.value.buttons[0],
          b: gamepad.value.buttons[1],
          x: gamepad.value.buttons[2],
          y: gamepad.value.buttons[3],
        },
        bumper: {
          left: gamepad.value.buttons[4],
          right: gamepad.value.buttons[5],
        },
        triggers: {
          left: gamepad.value.buttons[6],
          right: gamepad.value.buttons[7],
        },
        stick: {
          left: {
            horizontal: gamepad.value.axes[0],
            vertical: gamepad.value.axes[1],
            button: gamepad.value.buttons[10],
          },
          right: {
            horizontal: gamepad.value.axes[2],
            vertical: gamepad.value.axes[3],
            button: gamepad.value.buttons[11],
          },
        },
        dpad: {
          up: gamepad.value.buttons[12],
          down: gamepad.value.buttons[13],
          left: gamepad.value.buttons[14],
          right: gamepad.value.buttons[15],
        },
        back: gamepad.value.buttons[8],
        start: gamepad.value.buttons[9],
      }
    }

    return null
  })
}

export function useGamepad(options: UseGamepadOptions = {}) {
  const {
    navigator = defaultNavigator,
  } = options
  const isSupported = navigator && 'getGamepads' in navigator
  const gamepads: Gamepad[] = reactive([])

  const onConnectedHook = createEventHook()
  const onDisconnectedHook = createEventHook()

  const stateFromGamepad = (gamepad: Gamepad) => {
    const hapticActuators = []
    const vibrationActuator = 'vibrationActuator' in gamepad ? (gamepad as any).vibrationActuator : null

    if (vibrationActuator)
      hapticActuators.push(vibrationActuator)

    if (gamepad.hapticActuators)
      hapticActuators.push(...gamepad.hapticActuators)

    return {
      id: gamepad.id,
      hapticActuators,
      index: gamepad.index,
      mapping: gamepad.mapping,
      connected: gamepad.connected,
      timestamp: gamepad.timestamp,
      axes: gamepad.axes.map(axes => axes),
      buttons: gamepad.buttons.map(button => ({ pressed: button.pressed, touched: button.touched, value: button.value })),
    }
  }

  const updateGamepadState = () => {
    const _gamepads = navigator?.getGamepads() || []

    for (let i = 0; i < _gamepads.length; ++i) {
      const gamepad = _gamepads[i]
      if (gamepad) {
        const index = gamepads.findIndex(({ index }) => index === gamepad.index)

        if (index > -1)
          gamepads[index] = stateFromGamepad(gamepad)
      }
    }
  }

  const { isActive, pause, resume } = useRafFn(updateGamepadState)

  const onGamepadConnected = (gamepad: Gamepad) => {
    if (!gamepads.some(({ index }) => index === gamepad.index))
      gamepads.push(stateFromGamepad(gamepad))

    resume()
  }

  const onGamepadDisconnected = () => {

  }

  useEventListener('gamepadconnected', e => onGamepadConnected(e.gamepad))
  useEventListener('gamepaddisconnected', onGamepadDisconnected)

  tryOnMounted(() => {
    const _gamepads = navigator?.getGamepads() || []

    if (_gamepads) {
      for (let i = 0; i < _gamepads.length; ++i) {
        const gamepad = _gamepads[i]

        if (gamepad)
          onGamepadConnected(gamepad)
      }
    }
  })

  pause()

  return {
    isSupported,
    onConnected: onConnectedHook.on,
    onDisconnected: onDisconnectedHook.on,
    gamepads,
    pause,
    resume,
    isActive,
  }
}
