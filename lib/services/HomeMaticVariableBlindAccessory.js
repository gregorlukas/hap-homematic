/*
 * File: HomeMaticVariableBinarySwitchAccessory.js
 * Project: hap-homematic
 * File Created: Saturday, 6th March 2021 5:08:26 pm
 * Author: Gregor Lukas (gregor@lukas.tk)
 * -----
 * The MIT License (MIT)
 *
 * Copyright (c) Gregor Lukas <gregor@lukas.tk> (https://github.com/gregorlukas)
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

module.exports = class HomeMaticVariableBlindAccessory extends HomeMaticAccessory {
  publishServices (Service, Characteristic) {
    let self = this
    this.delayOnSet = 750

    if (this.variable) {

      if ((this.variable.valuetype === 4) && (this.variable.subtype === 0)) {
        this.minValue = parseFloat(this.variable.minvalue)
        this.maxValue = parseFloat(this.variable.maxvalue)

        let blind = this.getService(Service.WindowCovering)

        this.currentPos = blind.getCharacteristic(Characteristic.CurrentPosition)
          .on('get', async (callback) => {
            self._ccu.getVariableValue(self.nameInCCU).then((newValue) => {
              callback(null, parseFloat(newValue))
            })
          })

        this.currentPos.eventEnabled = true

        this.targetPos = blind.getCharacteristic(Characteristic.TargetPosition)
          .on('get', async (callback) => {
            self.debugLog('return previously selected target position %s', self.targetLevel)
            callback(null, self.targetLevel)
          })

          .on('set', (value, callback) => {
            if (parseFloat(value) < self.minValueClose) {
              value = parseFloat(self.minValueClose)
            }
  
            if (parseFloat(value) > self.maxValueOpen) {
              value = parseFloat(self.maxValueOpen)
            }

            self.targetLevel = value
            self.debugLog('send new targetlevel %s', self.targetLevel)
            self.eventupdate = false // whaat?
            clearTimeout(self.setTime)
            self.isWorking = true
            self.setTime = setTimeout(() => {
              if (self.reverse === true) {
                value = 100 - value
              }
              self._ccu.setVariable(self.nameInCCU, parseFloat(value))
            }, self.delayOnSet)
              callback()
          })

      }

      /*this.registerAddressForEventProcessingAtAccessory(this.buildAddress(this.nameInCCU), (newValue) => {
        if (self.state) {
          self.state.updateValue(self.isTrue(newValue), null)
        }

        if (self.level) {
          self.log.debug('[Variable] update level %s', parseFloat(newValue))
          self.updateCharacteristic(self.level, parseFloat(newValue))
          let isOn = (parseFloat(newValue) > self.minValue) ? 1 : 0
          self.log.debug('[Variable] update setOn %s', isOn)
          self.updateCharacteristic(self.isOnCharacteristic, isOn)
        }
      })*/
    } else {
      this.log.error('[Variable] variable object was not set')
    }
  }

  shutdown () {
    super.shutdown()
    clearTimeout(this.timer)
  }

  async updateVariable () {

  }

  static channelTypes () {
    return ['VARIABLE']
  }

  static serviceDescription () {
    return 'This service provides a blind to control variables'
  }

  static configurationItems () {
    return {}
  }

  static validate (configurationItem) {
    return false
  }
}
