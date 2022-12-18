/*
 * File: HomeMaticIPWinmaticAccessory.js
 * Project: hap-homematic
 * File Created: Monday, 20th April 2020 6:42:07 pm
 * Author: Thomas Kluge (th.kluge@me.com), Gregor Lukas (gregor@smartandcozy.com)
 * -----
 * The MIT License (MIT)
 *
 * Copyright (c) Thomas Kluge <th.kluge@me.com> (https://github.com/thkl)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * ==========================================================================
 */

const path = require('path')
const HomeMaticAccessory = require(path.join(__dirname, 'HomeMaticAccessory.js'))

class HomeMaticIPWinmaticAccessory extends HomeMaticAccessory {
  publishServices (Service, Characteristic) {
    let self = this
    this.setByHomeKit = false
    this.isWorking = false
    let service = this.addService(new Service.Window(this._name))

    this.hazCurrentLevel = (this.getDataPointNameFromSettings('getlevel', null))

    this.delayOnSet = 1500

    this.currentPosition = service.getCharacteristic(Characteristic.CurrentPosition)
      .on('get', async (callback) => {
        let value
        if (this.hazCurrentLevel) {
          value = await self.getValueForDataPointNameWithSettingsKey('getlevel', null, true)
        } else {
          value = await self.getValueForDataPointNameWithSettingsKey('level', null, true)
        }
        value = self.processWindowLevel(value)
        self.debugLog('getCurrent Position %s', value)
        if (callback) callback(null, value)
      })
      //Needed?
      /*.on('set', (value, callback) => {
        callback()
      })*/

    this.currentPosition.eventEnabled = true

    this.targetPosition = service.getCharacteristic(Characteristic.TargetPosition)
    .on('get', async (callback) => {
      let value
      if (this.hazCurrentLevel) {
        value = await self.getValueForDataPointNameWithSettingsKey('getlevel', null, true)
      } else {
        value = await self.getValueForDataPointNameWithSettingsKey('level', null, true)
      }
      value = self.processWindowLevel(value)
      if (callback) {
        self.debugLog('return %s as TargetPosition', value)
        callback(null, value)
      }
    })
    .on('set', (value, callback) => {
      self.debugLog('set target position %s with delay %s', value, self.delayOnSet)

      let sValue = parseFloat(value) / 100

      self.targetLevel = sValue
      self.eventupdate = true
      clearTimeout(self.setTimer)
      self.setTimer = setTimeout(() => {
        self.setHomeMaticLevels()
      }, self.delayOnSet)
      
      callback()
    })

    this.targetPosition.eventEnabled = true

    this.position = service.getCharacteristic(Characteristic.PositionState)
      .on('get', async (callback) => {
        let value = await self.getValueForDataPointNameWithSettingsKey('activity', null, true)
        if (callback) {
          var result = 2
          if (value !== undefined) {
            switch (value) {
              case 0:
                result = 2 // Characteristic.PositionState.STOPPED
                break
              case 1:
                result = 0 // Characteristic.PositionState.DECREASING
                break
              case 2:
                result = 1 // Characteristic.PositionState.INCREASING
                break
              case 3:
                result = 2 // Characteristic.PositionState.STOPPED
                break
            }
            callback(null, result)
          } else {
            callback(null, '0')
          }
        }
      })

    this.position.eventEnabled = true

    this.registerAddressWithSettingsKeyForEventProcessingAtAccessory('activity', null, (newValue) => {
      self.updatePosition(parseInt(newValue))
    })

    if (this.hazCurrentLevel) {
      this.registerAddressWithSettingsKeyForEventProcessingAtAccessory('getlevel', null, (newValue) => {
        if (self.isWorking === false) {
          self.debugLog('set final HomeKitValue to %s', newValue)
          self.setFinalWindowLevel(newValue)
          self.realLevel = parseFloat(newValue * 100)
        } else {
          let lvl = self.processWindowLevel(newValue)
          self.realLevel = parseFloat(newValue * 100)
          self.debugLog('set currentPos HomeKitValue to %s', lvl)
          self.currentLevel = lvl
          self.updateCharacteristic(self.currentPosition, self.currentLevel)
        }
      })
    } else {
      this.registerAddressWithSettingsKeyForEventProcessingAtAccessory('level', null, (newValue) => {
        if (self.isWorking === false) {
          self.debugLog('set final HomeKitValue to %s', newValue)
          self.setFinalWindowLevel(newValue)
          self.realLevel = parseFloat(newValue * 100)
        } else {
          let lvl = self.processWindowLevel(newValue)
          self.realLevel = parseFloat(newValue * 100)
          self.debugLog('set HomeKitValue to %s', lvl)
          self.currentLevel = lvl
          self.updateCharacteristic(self.currentPosition, self.currentLevel)
        }
      })
    }

    this.registerAddressWithSettingsKeyForEventProcessingAtAccessory('process', null, (newValue) => {
      // Working false will trigger a new remote query
      self.debugLog('process event received')
      if (parseInt(newValue) === 0) {
        self.debugLog('Blind has settled')
        self.isWorking = false
        let lvlKey = 'level'
        if (self.hazCurrentLevel) {
          lvlKey = 'getlevel'
        }

        self.getValueForDataPointNameWithSettingsKey(lvlKey, null, true).then(result => {
          self.debugLog('Blind has settled here is the new position %s', result)
          self.setFinalWindowLevel(result)
          self.realLevel = parseFloat(result * 100)
        })
      } else {
        self.debugLog('Blind start moving')
        self.isWorking = true
        //update position characteristic here
      }
    })

  }

  setHomeMaticLevels() {
    if (this.targetLevel !== undefined) {
      this.debugLog('%s setHomeMaticLevels  Level %s', this._serial, this.targetLevel)
      this.setValueForDataPointNameWithSettingsKey('level', null, this.targetLevel)
    }
  }

  processWindowLevel(newValue) {
    var value = parseFloat(newValue)
    value = value * 100
    this.realLevel = value
    this.reportedLevel = value
    return value
  
  }

  setFinalWindowLevel(value) {
    value = this.processWindowLevel(value)
    this.debugLog('Updating Final window level %s', value)
    this.updateCharacteristic(this.currentPosition, value)
    this.updateCharacteristic(this.targetPos, value)
    this.updateCharacteristic(this.position, 2) // STOPPED
  }

  updatePosition(value) {
    // 0 = UNKNOWN (Standard)
    // 1=UP
    // 2=DOWN
    // 3=STABLE
    switch (value) {
      case 0:
        this.updateCharacteristic(this.position, 2)
        break
      case 1: // opening - INCREASING
        this.updateCharacteristic(this.position, 1)
        // set target position to maximum, since we don't know when it stops
        break
      case 2: // closing - DECREASING
        this.updateCharacteristic(this.position, 0)
        // same for closing
        break
      case 3:
        this.updateCharacteristic(this.position, 2)
        break
    }
  }

  initServiceSettings() {
    return {
      'SHUTTER_VIRTUAL_RECEIVER': {
        inhibit: { name: '4.INHIBIT' },
        activity: { name: '3.ACTIVITY_STATE' },
        level: { name: '4.LEVEL' },
        getlevel: { name: '3.LEVEL' },
        process: { name: '3.PROCESS' }
      },
      'BLIND_VIRTUAL_RECEIVER': {
        inhibit: { name: '4.INHIBIT' },
        activity: { name: '4.ACTIVITY_STATE' },
        level: { name: '4.LEVEL' },
        process: { name: '4.PROCESS' },
        slats: { name: '4.LEVEL_2' }
      },
      'HmIPW-DRBL4:BLIND_VIRTUAL_RECEIVER': {
        inhibit: { name: 'INHIBIT' },
        activity: { name: 'ACTIVITY_STATE' },
        level: { name: 'LEVEL' },
        process: { name: 'PROCESS' },
        slats: { name: 'LEVEL_2' }
      },
      'HmIP-HDM1:SHADING_RECEIVER': {
        inhibit: { name: 'INHIBIT' },
        activity: { name: 'ACTIVITY_STATE' },
        level: { name: 'LEVEL' },
        process: { name: 'PROCESS' }
      },
      'HmIP-DRBLI4:BLIND_VIRTUAL_RECEIVER': {
        inhibit: { name: 'INHIBIT' },
        activity: { name: 'ACTIVITY_STATE' },
        level: { name: 'LEVEL' },
        process: { name: 'PROCESS' },
        slats: { name: 'LEVEL_2' }
      },
    }
  }

 static channelTypes() {
    return ['SHUTTER_VIRTUAL_RECEIVER', 'BLIND_VIRTUAL_RECEIVER', 'SHADING_RECEIVER']
  }

  static serviceDescription () {
    return 'This service provides a window device for HomeKit'
  }

  static configurationItems () {
    return {}
  }

  static validate (configurationItem) {
    return false
  }
}

module.exports = HomeMaticIPWinmaticAccessory
