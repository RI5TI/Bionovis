import Vue from 'vue'

import 'materialize-css/dist/css/materialize.min.css'
import 'material-design-icons/iconfont/material-icons.css'

import App from './App.vue'


Vue.use(require('vue-moment'))

new Vue({
    render: h => h(App)
}).$mount('#app')