/*
 * Copyright (c) 2004-2021, University of Oslo
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 * Neither the name of the HISP project nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
package org.hisp.dhis.schema.introspection;

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;

import org.apache.commons.lang3.StringUtils;
import org.hisp.dhis.common.AnalyticalObject;
import org.hisp.dhis.common.EmbeddedObject;
import org.hisp.dhis.common.IdentifiableObject;
import org.hisp.dhis.common.NameableObject;
import org.hisp.dhis.node.annotation.NodeAnnotation;
import org.hisp.dhis.node.annotation.NodeCollection;
import org.hisp.dhis.node.annotation.NodeComplex;
import org.hisp.dhis.node.annotation.NodeRoot;
import org.hisp.dhis.node.annotation.NodeSimple;
import org.hisp.dhis.schema.Property;
import org.hisp.dhis.system.util.ReflectionUtils;

import com.google.common.collect.Lists;
import com.google.common.primitives.Primitives;

/**
 * A {@link PropertyIntrospector} adds {@link Property} values to the map for
 * all fields which are annotated with an {@link Annotation} that itself is
 * annotated with {@link NodeAnnotation}.
 *
 * The added {@link Property} values are initialised based on the present
 * annotations. Handled are:
 * <ul>
 * <li>{@link NodeSimple}</li>
 * <li>{@link NodeRoot}</li>
 * <li>{@link NodeComplex}</li>
 * <li>{@link NodeCollection}</li>
 * </ul>
 *
 * @author Morten Olav Hansen <mortenoh@gmail.com>
 * @author Jan Bernitt (extraction to this class)
 */
@Slf4j
public class NodePropertyIntrospector implements PropertyIntrospector
{

    public static Property setPropertyIfCollection( Property property, Field field, Class<?> klass )
    {
        property.setCollection( true );
        property.setCollectionName( field.getName() );

        Type type = field.getGenericType();

        if ( type instanceof ParameterizedType )
        {
            ParameterizedType parameterizedType = (ParameterizedType) type;
            Class<?> itemKlass = (Class<?>) parameterizedType.getActualTypeArguments()[0];
            property.setItemKlass( itemKlass );

            property.setIdentifiableObject( IdentifiableObject.class.isAssignableFrom( itemKlass ) );
            property.setNameableObject( NameableObject.class.isAssignableFrom( itemKlass ) );
            property.setEmbeddedObject( EmbeddedObject.class.isAssignableFrom( klass ) );
            property.setAnalyticalObject( AnalyticalObject.class.isAssignableFrom( klass ) );
        }

        return property;
    }

    @Override
    public void introspect( Class<?> klass, Map<String, Property> propertyMap )
    {

        for ( Field field : ReflectionUtils.getAllFields( klass ) )
        {
            Property property = createProperty( klass, field );

            if ( property == null )
            {
                continue;
            }

            if ( field.isAnnotationPresent( NodeSimple.class ) )
            {
                NodeSimple nodeSimple = field.getAnnotation( NodeSimple.class );
                handleNodeSimple( nodeSimple, property );
            }
            else if ( field.isAnnotationPresent( NodeComplex.class ) )
            {
                NodeComplex nodeComplex = field.getAnnotation( NodeComplex.class );
                handleNodeComplex( nodeComplex, property );
            }
            else if ( field.isAnnotationPresent( NodeCollection.class ) )
            {
                NodeCollection nodeCollection = field.getAnnotation( NodeCollection.class );
                handleNodeCollection( nodeCollection, property );
            }

            propertyMap.put( property.key(), property );
        }
    }

    private Property createProperty( Class<?> klass, Field field )
    {
        for ( Annotation annotation : field.getAnnotations() )
        {
            // search for and add all annotations that meta-annotated with
            // NodeAnnotation
            if ( annotation.annotationType().isAnnotationPresent( NodeAnnotation.class ) )
            {
                Method getter = getGetter( klass, field );
                Method setter = getSetter( klass, field );

                Property property = new Property( Primitives.wrap( field.getType() ), getter, setter );
                property.setName( field.getName() );
                property.setFieldName( field.getName() );

                if ( Collection.class.isAssignableFrom( field.getType() ) )
                {
                    return setPropertyIfCollection( property, field, klass );
                }
                return property;
            }
        }
        return null;
    }

    private static void handleNodeSimple( NodeSimple nodeSimple, Property property )
    {
        property.setSimple( true );
        property.setAttribute( nodeSimple.isAttribute() );
        property.setNamespace( nodeSimple.namespace() );
        property.setWritable( nodeSimple.isWritable() );
        property.setReadable( nodeSimple.isReadable() );

        if ( !nodeSimple.isWritable() )
        {
            property.setSetterMethod( null );
        }

        if ( !nodeSimple.isReadable() )
        {
            property.setGetterMethod( null );
        }

        if ( !StringUtils.isEmpty( nodeSimple.value() ) )
        {
            property.setName( nodeSimple.value() );
        }
    }

    private static void handleNodeComplex( NodeComplex nodeComplex, Property property )
    {
        property.setSimple( false );
        property.setNamespace( nodeComplex.namespace() );
        property.setWritable( nodeComplex.isWritable() );
        property.setReadable( nodeComplex.isReadable() );

        if ( !nodeComplex.isWritable() )
        {
            property.setSetterMethod( null );
        }

        if ( !nodeComplex.isReadable() )
        {
            property.setGetterMethod( null );
        }

        if ( !StringUtils.isEmpty( nodeComplex.value() ) )
        {
            property.setName( nodeComplex.value() );
        }
    }

    private static void handleNodeCollection( NodeCollection nodeCollection, Property property )
    {
        property.setCollectionWrapping( nodeCollection.useWrapping() );
        property.setNamespace( nodeCollection.namespace() );
        property.setWritable( nodeCollection.isWritable() );
        property.setReadable( nodeCollection.isReadable() );

        if ( !nodeCollection.isWritable() )
        {
            property.setSetterMethod( null );
        }

        if ( !nodeCollection.isReadable() )
        {
            property.setGetterMethod( null );
        }

        if ( !StringUtils.isEmpty( nodeCollection.value() ) )
        {
            property.setCollectionName( nodeCollection.value() );
        }
        else
        {
            property.setCollectionName( property.getName() );
        }

        if ( !StringUtils.isEmpty( nodeCollection.itemName() ) )
        {
            property.setName( nodeCollection.itemName() );
        }
        else // if itemName is not set, check to see if itemKlass have a
             // @RootNode with a name
        {
            if ( property.getItemKlass() != null && property.getItemKlass().isAnnotationPresent( NodeRoot.class ) )
            {
                NodeRoot nodeRoot = property.getItemKlass().getAnnotation( NodeRoot.class );

                if ( !StringUtils.isEmpty( nodeRoot.value() ) )
                {
                    property.setName( nodeRoot.value() );
                }
            }
        }
    }

    private static Method getGetter( Class<?> klass, Field field )
    {
        return getMethodWithPrefix( klass, field, Lists.newArrayList( "get", "is", "has" ), false );
    }

    private static Method getSetter( Class<?> klass, Field field )
    {
        return getMethodWithPrefix( klass, field, Lists.newArrayList( "set" ), true );
    }

    private static Method getMethodWithPrefix( Class<?> klass, Field field, List<String> prefixes, boolean includeType )
    {
        String name = StringUtils.capitalize( field.getName() );
        List<Method> methods = new ArrayList<>();

        for ( String prefix : prefixes )
        {
            try
            {
                Method method = includeType
                    ? klass.getMethod( prefix + name, field.getType() )
                    : klass.getMethod( prefix + name );

                methods.add( method );
            }
            catch ( NoSuchMethodException ignored )
            {
                /* ignore */
            }
        }

        // TODO should we just return null in this case? if this happens, its
        // clearly a mistake
        if ( methods.size() > 1 )
        {
            log.error( "More than one method found for field " + field.getName() + " on class " + klass.getName()
                + ", Methods: " + methods + ". Using method: " + methods.get( 0 ).getName() + "." );
        }

        return methods.isEmpty() ? null : methods.get( 0 );
    }
}